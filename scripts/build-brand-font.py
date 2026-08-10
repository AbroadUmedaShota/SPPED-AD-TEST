#!/usr/bin/env python3
"""Build the SPEED AD wordmark webfont from the approved per-letter SVGs.

Install the build-only dependencies with:
  python -m pip install "fonttools[woff]"
"""

from __future__ import annotations

import argparse
import hashlib
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path


UNITS_PER_EM = 1000
CAP_HEIGHT = 700
ASCENT = 800
DESCENT = -200
SOURCE_CAP_HEIGHT = 145
SOURCE_SCALE = CAP_HEIGHT / SOURCE_CAP_HEIGHT
# 1970-01-01 in the OpenType epoch. A fixed value keeps WOFF2 reproducible.
FONT_TIMESTAMP = 2082844800
GLYPH_DIRECTORY = '決定フォント_１文字ごと【07.基本】ブラックスタイル'
GLYPH_FILES = {
    'A': '06_A_基本-2.svg',
    'D': '06_D1_基本-2.svg',
    'E': '06_E1_基本-2.svg',
    'P': '06_P_基本-2.svg',
    'S': '06_S_基本-2.svg',
}

# Advances reproduce the approved wordmark composition. Values are expressed
# in the 145-unit source coordinate system before scaling to the font UPM.
SOURCE_ADVANCES = {
    'A': 189,
    'D': 199,
    'E': 174,
    'P': 182,
    'S': 183,
    'space': 41,
}
WORDMARK_PAIRS = [('S', 'P'), ('P', 'E'), ('E', 'E'), ('E', 'D'), ('A', 'D')]
WORDMARK_TRACKING = -34
WORDMARK_FIRST_LINE = 'SPEED'
WORDMARK_LINE_WIDTH_PADDING = 8


def source_path_data(svg_path: Path) -> str:
    root = ET.parse(svg_path).getroot()
    path = root.find('{http://www.w3.org/2000/svg}path')
    if path is None or not path.get('d'):
        raise ValueError(f'No SVG path found in {svg_path}')
    view_box = root.get('viewBox', '')
    if not re.fullmatch(r'0(?:\.0+)? 0(?:\.0+)? \d+(?:\.\d+)? 145(?:\.0+)?', view_box):
        raise ValueError(f'Unexpected viewBox in {svg_path}: {view_box!r}')
    return path.get('d', '')


def svg_contours(path_data: str) -> list[RecordingPen]:
    recording = RecordingPen()
    parse_path(path_data, recording)
    contours = []
    current = RecordingPen()
    for operation, operands in recording.value:
        if operation == 'moveTo' and current.value:
            current.value.append(('closePath', ()))
            contours.append(current)
            current = RecordingPen()
        if operation == 'endPath':
            operation = 'closePath'
        current.value.append((operation, operands))
        if operation in {'closePath', 'endPath'}:
            contours.append(current)
            current = RecordingPen()
    if current.value:
        contours.append(current)
    return contours


def contour_area(contour: RecordingPen) -> float:
    area_pen = AreaPen()
    contour.replay(area_pen)
    return area_pen.value


def build_glyph(svg_path: Path):
    glyph_pen = TTGlyphPen(None)
    quadratic_pen = Cu2QuPen(glyph_pen, max_err=1.0, reverse_direction=False)
    transformed_pen = TransformPen(
        quadratic_pen,
        (SOURCE_SCALE, 0, 0, -SOURCE_SCALE, 0, CAP_HEIGHT),
    )
    contours = svg_contours(source_path_data(svg_path))
    areas = [contour_area(contour) for contour in contours]
    outer_index = max(range(len(contours)), key=lambda index: abs(areas[index]))
    outer_sign = areas[outer_index] >= 0
    for index, contour in enumerate(contours):
        is_inner = index != outer_index
        same_direction_as_outer = (areas[index] >= 0) == outer_sign
        destination_pen = transformed_pen
        if is_inner and same_direction_as_outer:
            destination_pen = ReverseContourPen(transformed_pen)
        contour.replay(destination_pen)
    return glyph_pen.glyph()


def scaled_advance(source_advance: int) -> int:
    return round(source_advance * SOURCE_SCALE)


def centered_left_side_bearing(glyph_name: str, glyphs: dict, advance: int) -> int:
    """Distribute unused advance width evenly around the glyph outline."""
    glyph = glyphs[glyph_name]
    if glyph.numberOfContours == 0:
        return 0
    glyph.recalcBounds(glyphs)
    ink_width = glyph.xMax - glyph.xMin
    return round((advance - ink_width) / 2)


def wordmark_pair_adjustments(metrics: dict[str, tuple[int, int]]) -> dict:
    """Return pair positioning that preserves composition plus optical tracking."""
    return {
        pair: metrics[pair[0]][1] - metrics[pair[1]][1] + WORDMARK_TRACKING
        for pair in WORDMARK_PAIRS
    }


def setup_wordmark_gpos(font, metrics: dict[str, tuple[int, int]]) -> None:
    pair_rules = '\n'.join(
        f'  pos {left} {right} {value};'
        for (left, right), value in wordmark_pair_adjustments(metrics).items()
    )
    addOpenTypeFeaturesFromString(
        font,
        f'languagesystem DFLT dflt;\nfeature kern {{\n{pair_rules}\n}} kern;\n',
    )


def wordmark_advance(text: str, metrics: dict[str, tuple[int, int]]) -> int:
    pair_adjustments = wordmark_pair_adjustments(metrics)
    total = sum(metrics['space' if character == ' ' else character][0] for character in text)
    total += sum(pair_adjustments.get(pair, 0) for pair in zip(text, text[1:]))
    return total


def write_font_css(css_path: Path, font_path: Path, metrics: dict[str, tuple[int, int]]) -> None:
    font_hash = hashlib.sha256(font_path.read_bytes()).hexdigest()[:12]
    line_width = (
        wordmark_advance(WORDMARK_FIRST_LINE, metrics) + WORDMARK_LINE_WIDTH_PADDING
    ) / UNITS_PER_EM
    block_offset = -metrics['A'][1] / UNITS_PER_EM
    first_line_indent = -(metrics['S'][1] - metrics['A'][1]) / UNITS_PER_EM
    css_path.parent.mkdir(parents=True, exist_ok=True)
    css_path.write_text(
        '@font-face {\n'
        '  font-family: "SPEED AD Wordmark";\n'
        f'  src: url("./{font_path.name}?v={font_hash}") format("woff2");\n'
        '  font-display: block;\n'
        '  font-style: normal;\n'
        '  font-weight: 400;\n'
        '}\n\n'
        ':root {\n'
        f'  --speed-ad-wordmark-first-line-width: {line_width:.3f}em;\n'
        f'  --speed-ad-wordmark-block-offset: {block_offset:.3f}em;\n'
        f'  --speed-ad-wordmark-first-line-indent: {first_line_indent:.3f}em;\n'
        '}\n',
        encoding='utf-8',
        newline='\n',
    )


def build_font(source_dir: Path, output_path: Path, metrics_css_path: Path) -> None:
    glyph_dir = source_dir / GLYPH_DIRECTORY
    if not glyph_dir.is_dir():
        raise FileNotFoundError(f'Approved glyph directory not found: {glyph_dir}')

    glyph_order = ['.notdef', 'space', 'A', 'D', 'E', 'P', 'S']
    glyphs = {
        '.notdef': TTGlyphPen(None).glyph(),
        'space': TTGlyphPen(None).glyph(),
    }
    for character, filename in GLYPH_FILES.items():
        glyphs[character] = build_glyph(glyph_dir / filename)

    metrics = {}
    for glyph_name in glyph_order:
        advance = scaled_advance(SOURCE_ADVANCES.get(glyph_name, 200))
        metrics[glyph_name] = (
            advance,
            centered_left_side_bearing(glyph_name, glyphs, advance),
        )

    builder = FontBuilder(UNITS_PER_EM, isTTF=True)
    builder.setupGlyphOrder(glyph_order)
    character_map = {ord(character): character for character in 'ADEPS'}
    character_map[ord(' ')] = 'space'
    builder.setupCharacterMap(character_map)
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT)
    builder.setupNameTable({
        'familyName': 'SPEED AD Wordmark',
        'styleName': 'Regular',
        'uniqueFontIdentifier': 'SPEEDADWordmark-Regular-1.2',
        'fullName': 'SPEED AD Wordmark Regular',
        'psName': 'SPEEDADWordmark-Regular',
        'version': 'Version 1.200',
    })
    builder.setupOS2(
        sTypoAscender=ASCENT,
        sTypoDescender=DESCENT,
        usWinAscent=ASCENT,
        usWinDescent=abs(DESCENT),
        sxHeight=0,
        sCapHeight=CAP_HEIGHT,
    )
    builder.setupPost()
    builder.setupMaxp()
    setup_wordmark_gpos(builder.font, metrics)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    builder.font['head'].created = FONT_TIMESTAMP
    builder.font['head'].modified = FONT_TIMESTAMP
    builder.font.recalcTimestamp = False
    builder.font.flavor = 'woff2'
    builder.font.save(output_path)
    write_font_css(metrics_css_path, output_path, metrics)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--source-dir',
        required=True,
        type=Path,
        help='Directory containing the approved SVG data and per-letter glyph folder.',
    )
    parser.add_argument(
        '--output',
        default=Path('fonts/speed-ad-wordmark.woff2'),
        type=Path,
    )
    parser.add_argument(
        '--metrics-css',
        default=Path('fonts/speed-ad-wordmark.css'),
        type=Path,
    )
    return parser.parse_args()


if __name__ == '__main__':
    arguments = parse_args()
    build_font(arguments.source_dir, arguments.output, arguments.metrics_css)
