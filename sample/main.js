import { populateTable, populateModal } from '../02_dashboard/src/ui/speedReviewRenderer.js';
import { handleOpenModal } from '../02_dashboard/src/modalHandler.js';
import { loadCommonHtml } from '../02_dashboard/src/utils.js';
import { initSidebarHandler } from '../02_dashboard/src/sidebarHandler.js';

// Full dataset from 0008000154ncd.csv
const rawCsvData = [
    { "ID": "7938", "名刺画像ファイル名（表）": "0008000154_00001_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "Hao", "氏名（名）": "Zongbin", "会社名": "Prinano Technology (Hangzhou) Co., Ltd.", "部署名": "", "役職名": "Partner & CTO Doctor", "郵便番号": "", "住所1": "Building 22, Changjiang Road, Binjiang District, Hangzhou, P.R. China", "住所2（建物名）": "", "電話番号1": "0571-8719-5865", "電話番号2": "", "携帯番号": "15852922679", "FAX番号": "", "メールアドレス": "haozb@prinano.com", "URL": "www.prinano.com", "その他（メモ等）": "" },
    { "ID": "7939", "名刺画像ファイル名（表）": "0008000154_00002_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "林", "氏名（名）": "朋幸", "会社名": "日本トムソン株式会社", "部署名": "技術センター　技術研究所　技術研究課", "役職名": "副主査", "郵便番号": "248-0022", "住所1": "神奈川県鎌倉市常盤392", "住所2（建物名）": "", "電話番号1": "0467-31-2416", "電話番号2": "", "携帯番号": "", "FAX番号": "0467-31-4481", "メールアドレス": "THayashi@ikonet.co.jp", "URL": "www.ikont.co.jp", "その他（メモ等）": "" },
    { "ID": "7940", "名刺画像ファイル名（表）": "0008000154_00003_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "卞", "氏名（名）": "舜生", "会社名": "株式会社ミツトヨ", "部署名": "研究開発本部　ソフトウェア開発部　F2課", "役職名": "副主任研究員　博士（科学）", "郵便番号": "213-0012", "住所1": "神奈川県川崎市高津区坂戸3-2-1", "住所2（建物名）": "かながわサイエンスパークR&D C棟632号", "電話番号1": "044-813-8220", "電話番号2": "", "携帯番号": "", "FAX番号": "", "メールアドレス": "sunseng_pyon@mitutoyo.co.jp", "URL": "https://www.mitutoyo.co.jp", "その他（メモ等）": "" },
    { "ID": "8278", "名刺画像ファイル名（表）": "0008000154_00004_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "宇佐美", "氏名（名）": "裕一", "会社名": "一般社団法人日本能率協会", "部署名": "事業推進本部　産業振興センター　ものづくり支援グループ", "役職名": "グループ長", "郵便番号": "105-8522", "住所1": "東京都港区芝公園3-1-22", "住所2（建物名）": "", "電話番号1": "03-3434-1988", "電話番号2": "", "携帯番号": "080-3737-4512", "FAX番号": "03-3434-8076", "メールアドレス": "yuichi_usami@jma.or.jp", "URL": "https://www.jma.or.jp", "その他（メモ等）": "" },
    { "ID": "8279", "名刺画像ファイル名（表）": "0008000154_00005_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "丸井", "氏名（名）": "朋久", "会社名": "株式会社東鋼", "部署名": "営業部　営業販売グループ", "役職名": "", "郵便番号": "113-0033", "住所1": "東京都文京区本郷5-27-10", "住所2（建物名）": "", "電話番号1": "03-3815-5811", "電話番号2": "", "携帯番号": "", "FAX番号": "03-3815-5911", "メールアドレス": "marui@toko-tool.co.jp", "URL": "https://www.toko-tool.co.jp", "その他（メモ等）": "" },
    { "ID": "8280", "名刺画像ファイル名（表）": "0008000154_00006_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "岩崎", "氏名（名）": "隆", "会社名": "サンワテクノス株式会社", "部署名": "エンジニアリング部　東京テクニカルセンター", "役職名": "専任副部長", "郵便番号": "130-0011", "住所1": "東京都墨田区石原4-31-7", "住所2（建物名）": "", "電話番号1": "03-5610-7080", "電話番号2": "", "携帯番号": "", "FAX番号": "03-3625-2377", "メールアドレス": "t_iwasaki@sunwa.co.jp", "URL": "", "その他（メモ等）": "" },
    { "ID": "8281", "名刺画像ファイル名（表）": "0008000154_00007_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "落合", "氏名（名）": "哲也", "会社名": "クレハ合繊株式会社", "部署名": "成形事業部　成形製造部", "役職名": "生産技術グループリーダー", "郵便番号": "321-0223", "住所1": "栃木県下都賀郡壬生町元町1-63", "住所2（建物名）": "", "電話番号1": "0282-82-2112", "電話番号2": "", "携帯番号": "", "FAX番号": "0282-82-2845", "メールアドレス": "t-ochiai@kureha-gohsen.co.jp", "URL": "", "その他（メモ等）": "" },
    { "ID": "8325", "名刺画像ファイル名（表）": "0008000154_00008_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "北岡", "氏名（名）": "秀樹", "会社名": "大豊産業株式会社", "部署名": "西日本本社　プラント事業部", "役職名": "次長", "郵便番号": "761-0113", "住所1": "香川県高松市屋島西町1902-1", "住所2（建物名）": "", "電話番号1": "087-841-2345", "電話番号2": "", "携帯番号": "080-6396-6267", "FAX番号": "087-841-3148", "メールアドレス": "hideki_kitaoka@taihos.co.jp", "URL": "http://www.taihos.co.jp/", "その他（メモ等）": "" },
    { "ID": "8795", "名刺画像ファイル名（表）": "0008000154_00009_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "藤澤", "氏名（名）": "浩之", "会社名": "扶桑鋼管株式会社", "部署名": "営業第1チーム", "役職名": "担当課長", "郵便番号": "279-0011", "住所1": "千葉県浦安市美浜1-9-2", "住所2（建物名）": "", "電話番号1": "047-354-8988", "電話番号2": "", "携帯番号": "090-7006-6586", "FAX番号": "047-354-4709", "メールアドレス": "fujisawa@fusoh-kokan.co.jp", "URL": "https://www.fusoh-kokan.co.jp/", "その他（メモ等）": "" },
    { "ID": "8796", "名刺画像ファイル名（表）": "0008000154_00010_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "淺野", "氏名（名）": "仁法", "会社名": "ダイドー株式会社", "部署名": "東日本営業統括部", "役職名": "東京支店長", "郵便番号": "132-0011", "住所1": "東京都江戸川区瑞江4-39-6", "住所2（建物名）": "", "電話番号1": "03-3676-9111", "電話番号2": "", "携帯番号": "080-5107-2261", "FAX番号": "03-3676-9119", "メールアドレス": "asano_kiminori@daido-net.co.jp", "URL": "", "その他（メモ等）": "" },
    { "ID": "8798", "名刺画像ファイル名（表）": "0008000154_00011_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "柴﨑", "氏名（名）": "剛", "会社名": "SMC株式会社", "部署名": "開発第4部", "役職名": "", "郵便番号": "300-2493", "住所1": "茨城県つくばみらい市絹の台4-2-2", "住所2（建物名）": "", "電話番号1": "050-3539-8640", "電話番号2": "", "携帯番号": "", "FAX番号": "0297-20-5062", "メールアドレス": "", "URL": "https://www.smcworld.com", "その他（メモ等）": "" },
    { "ID": "8799", "名刺画像ファイル名（表）": "0008000154_00012_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "友澤", "氏名（名）": "有希", "会社名": "株式会社ナノオプト・メディア", "部署名": "営業本部", "役職名": "", "郵便番号": "160-0022", "住所1": "東京都新宿区新宿1-12-5", "住所2（建物名）": "Uni-works新宿御苑3階", "電話番号1": "03-6258-0582", "電話番号2": "", "携帯番号": "080-3603-0236", "FAX番号": "03-6258-0598", "メールアドレス": "ytomozawa@f2ff.jp", "URL": "https://nanooptmedia.jp/", "その他（メモ等）": "" },
    { "ID": "8801", "名刺画像ファイル名（表）": "0008000154_00013_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "長谷川", "氏名（名）": "諒", "会社名": "株式会社MonotaRO", "部署名": "商品部門　商品採用Bグループ", "役職名": "", "郵便番号": "530-0001", "住所1": "大阪府大阪市北区梅田3-2-2", "住所2（建物名）": "JPタワー大阪22階", "電話番号1": "", "電話番号2": "", "携帯番号": "070-2907-0038", "FAX番号": "", "メールアドレス": "ryo.hasegawa@monotaro.com", "URL": "", "その他（メモ等）": "" },
    { "ID": "8802", "名刺画像ファイル名（表）": "0008000154_00014_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "張", "氏名（名）": "秉豐", "会社名": "エッペンドルフ・ハイマック・テクノロジーズ株式会社", "部署名": "R&D Mechanics", "役職名": "メカニカルエンジニア", "郵便番号": "312-8502", "住所1": "茨城県ひたちなか市武田1060", "住所2（建物名）": "", "電話番号1": "029-276-7380", "電話番号2": "", "携帯番号": "", "FAX番号": "029-276-0099", "メールアドレス": "Chang.P@eppendorf.jp", "URL": "www.eppendorf.com", "その他（メモ等）": "" },
    { "ID": "8803", "名刺画像ファイル名（表）": "0008000154_00015_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "村松", "氏名（名）": "昌幸", "会社名": "株式会社ダッド", "部署名": "東京営業所　経営企画室　セールスマーケティングG", "役職名": "主任", "郵便番号": "169-0075", "住所1": "東京都新宿区高田馬場3-1-5", "住所2（建物名）": "サンパティオ高田馬場309号室", "電話番号1": "", "電話番号2": "", "携帯番号": "080-6970-8442", "FAX番号": "", "メールアドレス": "muramatsu@dad.co.jp", "URL": "", "その他（メモ等）": "" },
    { "ID": "8804", "名刺画像ファイル名（表）": "0008000154_00016_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "田北", "氏名（名）": "順也", "会社名": "TOPPAN株式会社", "部署名": "西日本事業本部　関西クロステックビジネスイノベーション事業部　第一営業本部　第三部（秋葉原）　2T", "役職名": "係長", "郵便番号": "110-8560", "住所1": "東京都台東区台東1-5-1", "住所2（建物名）": "", "電話番号1": "", "電話番号2": "", "携帯番号": "080-2467-1894", "FAX番号": "", "メールアドレス": "junya.takita@toppan.co.jp", "URL": "", "その他（メモ等）": "" },
    { "ID": "8805", "名刺画像ファイル名（表）": "0008000154_00017_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "菅原", "氏名（名）": "直也", "会社名": "日本パルスモーター株式会社", "部署名": "開発本部　第三システム部", "役職名": "", "郵便番号": "207-0022", "住所1": "東京都東大和市桜が丘2-249", "住所2（建物名）": "", "電話番号1": "042-564-2275", "電話番号2": "", "携帯番号": "", "FAX番号": "042-565-5551", "メールアドレス": "n-sugahara@npm.co.jp", "URL": "https://www.pulsemotor.com/", "その他（メモ等）": "" },
    { "ID": "8806", "名刺画像ファイル名（表）": "0008000154_00018_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "櫻井", "氏名（名）": "伸之介", "会社名": "大森機械工業株式會社", "部署名": "技術生産本部　長岡工場　長岡技術部　長岡機械設計部　機械設計1グループ", "役職名": "主任", "郵便番号": "940-2045", "住所1": "新潟県長岡市西陵町2674-6", "住所2（建物名）": "雲出工業団地内", "電話番号1": "0258-46-8100", "電話番号2": "0258-46-8101", "携帯番号": "", "FAX番号": "0258-21-4145", "メールアドレス": "ssakurai@omori.co.jp", "URL": "https://www.omori.co.jp/", "その他（メモ等）": "" },
    { "ID": "8807", "名刺画像ファイル名（表）": "0008000154_00019_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "位坂", "氏名（名）": "玄輝", "会社名": "株式会社ディスコ", "部署名": "呉工場　製造本部　砥石製造部　GQAグループ　AEDチーム", "役職名": "", "郵便番号": "737-0198", "住所1": "広島県呉市広文化町1-23", "住所2（建物名）": "", "電話番号1": "", "電話番号2": "", "携帯番号": "", "FAX番号": "", "メールアドレス": "hisaka@disco.co.jp", "URL": "", "その他（メモ等）": "" },
    { "ID": "8808", "名刺画像ファイル名（表）": "0008000154_00020_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "田代", "氏名（名）": "康太", "会社名": "株式会社ブリヂストン", "部署名": "タイヤ生産技術開発部門　成型生産技術生産財タイヤ設備開発課", "役職名": "", "郵便番号": "187-8531", "住所1": "東京都小平市小川東町3-1-1", "住所2（建物名）": "", "電話番号1": "042-303-3665", "電話番号2": "", "携帯番号": "", "FAX番号": "042-342-8139", "メールアドレス": "kota.tashiro@bridgestone.com", "URL": "", "その他（メモ等）": "" },
    { "ID": "8809", "名刺画像ファイル名（表）": "0008000154_00021_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "日髙", "氏名（名）": "義文", "会社名": "富士工業株式会社", "部署名": "FA・ロボティクス事業本部　FA・ロボティクスソリューショングループ", "役職名": "本部長　兼　グループマネージャー", "郵便番号": "101-0061", "住所1": "東京都千代田区神田三崎町3-1-16", "住所2（建物名）": "神保町北東急ビル6F", "電話番号1": "03-6758-0791", "電話番号2": "", "携帯番号": "090-3618-9363", "FAX番号": "03-6758-0794", "メールアドレス": "y-hidaka@fkknet.co.jp", "URL": "https://www.ozax.co.jp/fkk", "その他（メモ等）": "" },
    { "ID": "8810", "名刺画像ファイル名（表）": "0008000154_00022_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "鄭", "氏名（名）": "", "会社名": "NT販売株式会社", "部署名": "ビジネスパートナー推進室", "役職名": "", "郵便番号": "141-0032", "住所1": "東京都品川区大崎1-2-2", "住所2（建物名）": "アートヴィレッジ大崎セントラルタワー13階", "電話番号1": "03-5435-5254", "電話番号2": "", "携帯番号": "070-2838-3713", "FAX番号": "03-5435-5260", "メールアドレス": "tomoya.t@nt-sales.co.jp", "URL": "https://www.nt-sales.co.jp", "その他（メモ等）": "" },
    { "ID": "8811", "名刺画像ファイル名（表）": "0008000154_00023_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "山口", "氏名（名）": "純司", "会社名": "株式会社ゼネラルアサヒ", "部署名": "営業本部　東京ダイレクトマーケティング部　第1グループ", "役職名": "グループリーダー", "郵便番号": "105-0004", "住所1": "東京都港区新橋4-21-3", "住所2（建物名）": "新橋東急ビル4F", "電話番号1": "03-6699-0185", "電話番号2": "", "携帯番号": "080-1711-6674", "FAX番号": "03-6699-0187", "メールアドレス": "junym@generalasahi.co.jp", "URL": "https://www.generalasahi.co.jp/", "その他（メモ等）": "" },
    { "ID": "8812", "名刺画像ファイル名（表）": "0008000154_00024_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "向", "氏名（名）": "創", "会社名": "クアーズテック合同会社", "部署名": "秦野事業所　技術・品質支援部", "役職名": "設備エンジニア", "郵便番号": "257-8566", "住所1": "神奈川県秦野市曽屋30", "住所2（建物名）": "", "電話番号1": "0463-84-6650", "電話番号2": "", "携帯番号": "080-4595-5272", "FAX番号": "", "メールアドレス": "Hajime_Mukai@Coorstek.com", "URL": "www.coorstek.co.jp", "その他（メモ等）": "" },
    { "ID": "8813", "名刺画像ファイル名（表）": "0008000154_00025_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "新島", "氏名（名）": "敦史", "会社名": "株式会社新樹社", "部署名": "編集第2部", "役職名": "次長", "郵便番号": "110-0005", "住所1": "東京都台東区上野7-11-6", "住所2（建物名）": "上野中央ビル", "電話番号1": "03-5828-0311", "電話番号2": "", "携帯番号": "", "FAX番号": "03-5828-0312", "メールアドレス": "a-niijima@press-shinjusha.co.jp", "URL": "https://press-shinjusha.co.jp", "その他（メモ等）": "" },
    { "ID": "8814", "名刺画像ファイル名（表）": "0008000154_00026_1.jpg", "名刺画像ファイル名（裏）": "", "氏名（姓）": "田中", "氏名（名）": "満波斗", "会社名": "三木プーリ株式会社", "部署名": "大阪支店　営業課", "役職名": "", "郵便番号": "564-0062", "住所1": "大阪府吹田市垂水町3-3-23", "住所2（建物名）": "", "電話番号1": "06-6385-5321", "電話番号2": "", "携帯番号": "070-4490-2232", "FAX番号": "06-6380-2315", "メールアドレス": "tanaka.mahato@mikipulley.co.jp", "URL": "www.mikipulley.co.jp", "その他（メモ等）": "" }
];

const businessCardData = rawCsvData;

let currentPage = 1;
const rowsPerPage = 20;

async function loadAllComponents() {
    try {
        await loadCommonHtml('header-placeholder', '../02_dashboard/common/header.html');
        await loadCommonHtml('footer-placeholder', '../02_dashboard/common/footer.html');
        await loadCommonHtml('sidebar-placeholder', '../02_dashboard/common/sidebar.html', () => {
            initSidebarHandler();
        });
        setupTable();
    } catch (error) {
        console.error('Failed to load components or initialize page:', error);
    }
}

function setupTable() {
    displayPage(currentPage);
    setupSearch(); // Call setupSearch here
}

function displayPage(page, data = businessCardData) {
    currentPage = page;
    const tableBody = document.getElementById('businessCardTableBody');
    const paginationContainer = document.getElementById('pagination-container');
    
    if (!tableBody || !paginationContainer) return;

    tableBody.innerHTML = '';
    paginationContainer.innerHTML = '';

    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = data.slice(startIndex, endIndex);

    paginatedData.forEach(item => {
        const row = document.createElement('tr');
        const address = (item['住所1'] || '') + ' ' + (item['住所2（建物名）'] || '');
        row.innerHTML = `
            <td>
                <div class="business-card-info">
                    <div class="company-logo-container">
                        <img src="logo.jpg" alt="Logo" class="company-logo">
                    </div>
                </div>
            </td>
            <td>${item['ID'] || ''}</td>
            <td>${(item['氏名（姓）'] || '') + ' ' + (item['氏名（名）'] || '')}</td>
            <td>${item['会社名'] || ''}</td>
            <td>${item['役職名'] || ''}</td>
            <td>${item['部署名'] || ''}</td>
            <td>${item['郵便番号'] || ''}</td>
            <td>${address}</td>
            <td>${item['電話番号1'] || ''}</td>
            <td>${item['携帯番号'] || ''}</td>
            <td>${item['FAX番号'] || ''}</td>
            <td>${item['メールアドレス'] || ''}</td>
            <td>${item['URL'] || ''}</td>
            <td>${item['その他（メモ等）'] || ''}</td>
            <td></td>
        `;
        tableBody.appendChild(row);
    });

    setupPagination(data);
}

function setupPagination(currentData = businessCardData) {
    const paginationContainer = document.getElementById('pagination-container');
    const pageCount = Math.ceil(currentData.length / rowsPerPage);

    // Clear existing pagination buttons
    paginationContainer.innerHTML = '';

    // Previous Button
    const prevButton = document.createElement('button');
    prevButton.textContent = '前へ';
    prevButton.className = 'px-4 py-2 mx-1 bg-gray-200 rounded disabled:opacity-50';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => displayPage(currentPage - 1, currentData));
    paginationContainer.appendChild(prevButton);

    // Page Number Buttons
    for (let i = 1; i <= pageCount; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = `px-4 py-2 mx-1 rounded ${i === currentPage ? 'bg-blue-500 text-white' : 'bg-gray-200'}`;
        pageButton.addEventListener('click', () => displayPage(i, currentData));
        paginationContainer.appendChild(pageButton);
    }

    // Next Button
    const nextButton = document.createElement('button');
    nextButton.textContent = '次へ';
    nextButton.className = 'px-4 py-2 mx-1 bg-gray-200 rounded disabled:opacity-50';
    nextButton.disabled = currentPage === pageCount;
    nextButton.addEventListener('click', () => displayPage(currentPage + 1, currentData));
    paginationContainer.appendChild(nextButton);
}

function setupSearch() {
    const searchInput = document.getElementById('searchKeyword');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
}

function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const filteredData = businessCardData.filter(item => {
        // Search in relevant fields
        const fullName = `${item['氏名（姓）'] || ''} ${item['氏名（名）'] || ''}`.toLowerCase();
        const companyName = (item['会社名'] || '').toLowerCase();
        const department = (item['部署名'] || '').toLowerCase();
        const address1 = (item['住所1'] || '').toLowerCase();
        const address2 = (item['住所2（建物名）'] || '').toLowerCase();
        const email = (item['メールアドレス'] || '').toLowerCase();
        const url = (item['URL'] || '').toLowerCase();

        return fullName.includes(searchTerm) ||
               companyName.includes(searchTerm) ||
               department.includes(searchTerm) ||
               address1.includes(searchTerm) ||
               address2.includes(searchTerm) ||
               email.includes(searchTerm) ||
               url.includes(searchTerm);
    });
    displayPage(1, filteredData); // Always go to the first page of filtered results
}

document.addEventListener('DOMContentLoaded', loadAllComponents);
