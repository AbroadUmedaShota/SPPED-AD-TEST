#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_PATH="$ROOT_DIR/docs/templates/issue_body.md"

if [ ! -f "$TEMPLATE_PATH" ]; then
  echo "Template not found: $TEMPLATE_PATH" >&2
  exit 1
fi

gh issue create --title "UI/UX���P: ���h�f�[�^���ݒ�Ƃ��烁�[���ݒ�y�[�W�̖������^�X�N�Ή�" \
  --body-file "$TEMPLATE_PATH" \
  --label "type:feature" \
  --label "status:planning"
