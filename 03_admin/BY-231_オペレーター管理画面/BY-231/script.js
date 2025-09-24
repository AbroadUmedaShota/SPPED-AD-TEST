document.addEventListener('DOMContentLoaded', function () {
    const operators = [];
    for (let i = 1; i <= 25; i++) {
        const groupNumber = (i % 5) + 1;
        operators.push({
            id: i,
            name: `オペレーター${i}`,
             affiliation: `グループ${groupNumber}`,
            status: (i % 2 === 0) ? '無効' : '有効',
            lastLogin: `2024/08/${(i % 30) + 1} ${Math.floor(Math.random() * 24)}:${Math.floor(Math.random() * 60)}`,
             authorityLevel: (i % 4) + 1,
              registrationDate: `2024/07/${(i % 30) + 1} ${Math.floor(Math.random() * 24)}:${Math.floor(Math.random() * 60)}`,
              updateDate: `2024/08/${(i % 30) + 1} ${Math.floor(Math.random() * 24)}:${Math.floor(Math.random() * 60)}`
        });
    }
  const tableBody = document.querySelector('table tbody');
    const modalTitle = document.getElementById('modal-title');
     const editOperatorIdInput = document.getElementById('editOperatorId');
     const editAffiliationSelect = document.getElementById('editAffiliation');
     const editOperatorNameInput = document.getElementById('editOperatorName');
     const modalContainer = document.getElementById('modal-container');
     const modal = document.getElementById('modal');
      const modalCloseButton = document.getElementById('modal-close-button');
      const modalCancelButton = document.getElementById('modal-cancel-button');
    const modalForm = document.getElementById('modal-form');
    const newOperatorButton = document.querySelector('.bg-blue-500');
      const authorityLevelSelect = document.getElementById('authorityLevel');
      const perPageSelect = document.getElementById('perPage');
     const currentPageSpan = document.getElementById('currentPage');
       const totalPagesSpan = document.getElementById('totalPages');
       const prevPageButton = document.querySelector('.flex justify-center mt-4 button:first-child');
        const nextPageButton = document.querySelector('.flex justify-center mt-4 button:last-child');
      const detailModalContainer =  document.getElementById('detail-modal-container');
      const detailModal =  document.getElementById('detail-modal');
       const detailModalCloseButton = document.getElementById('detail-modal-close-button');
        const detailModalContent = document.getElementById('detail-modal-content');

        let currentPage = 1;
        let perPage = parseInt(perPageSelect.value);

    // テーブルの行を生成する関数
    function generateTableRows() {
      tableBody.innerHTML = '';
         const startIndex = (currentPage - 1) * perPage;
         const endIndex = startIndex + perPage;

         const currentOperators = operators.slice(startIndex,endIndex)
         currentOperators.forEach(operator => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="py-2 px-4 border-b">${operator.id}</td>
                 <td class="py-2 px-4 border-b"><a href="#" class="text-blue-500 hover:text-blue-700" data-id="${operator.id}">${operator.name}</a></td>
                 <td class="py-2 px-4 border-b">${operator.affiliation}</td>
                <td class="py-2 px-4 border-b">${operator.status}</td>
                <td class="py-2 px-4 border-b">${operator.lastLogin}</td>
                <td class="py-2 px-4 border-b">
                    <div class="action-buttons">
                        <button class="edit-button" data-id="${operator.id}">編集</button>
                    </div>
                </td>
            `;
           tableBody.appendChild(row);
         });
    }
       function updatePagination(){
        totalPagesSpan.textContent = Math.ceil(operators.length / perPage);
         currentPageSpan.textContent = currentPage;
         prevPageButton.disabled = currentPage === 1;
        nextPageButton.disabled = currentPage === parseInt(totalPagesSpan.textContent)
     }
    function changePage(newPage){
        if (newPage < 1 || newPage > parseInt(totalPagesSpan.textContent)) {
             return;
           }
           currentPage = newPage;
          generateTableRows();
          updatePagination()

    }
      generateTableRows();
       updatePagination()


    perPageSelect.addEventListener('change', function () {
        perPage = parseInt(perPageSelect.value);
         currentPage = 1;
       generateTableRows();
          updatePagination();
    });
    prevPageButton.addEventListener('click', ()=> changePage(currentPage - 1))
     nextPageButton.addEventListener('click', ()=> changePage(currentPage + 1))
   //テーブルソート機能
const table = document.querySelector('table');
const headers = table.querySelectorAll('th[data-sort]');

 headers.forEach(header => {
    header.addEventListener('click', () => {
        const column = header.getAttribute('data-sort');
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        const isAscending = header.classList.contains('asc');

      rows.sort((rowA, rowB) => {
          const cellA = rowA.querySelector(`td:nth-child(${Array.from(header.parentNode.children).indexOf(header)+1})`).textContent;
            const cellB = rowB.querySelector(`td:nth-child(${Array.from(header.parentNode.children).indexOf(header)+1})`).textContent;

        if(column === 'id'){
           return isAscending ?  parseInt(cellA) - parseInt(cellB) : parseInt(cellB) - parseInt(cellA);
        } else if (column === 'lastLogin'){
           return isAscending ? new Date(cellA) - new Date(cellB) : new Date(cellB) - new Date(cellA);
        } else {
         return isAscending ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
          }

        });

     table.querySelector('tbody').innerHTML = '';
      rows.forEach(row => table.querySelector('tbody').appendChild(row));

       //ヘッダーのソート状態を更新
        headers.forEach(h => {
           h.classList.remove('asc','desc');
           });
        header.classList.toggle(isAscending ? 'desc':'asc');
       });
   });
    // 新規作成ボタンがクリックされた時の処理
   newOperatorButton.addEventListener('click', function() {
       modalTitle.textContent = '新規オペレーター登録';
        modalForm.reset();
         editOperatorIdInput.value ="自動採番"
       modalContainer.classList.remove('hidden'); // モーダルを表示
         authorityLevelSelect.closest('div').classList.add('hidden');
   });

    // モーダルを閉じる処理
     function closeModal() {
         modalContainer.classList.add('hidden'); // モーダルを非表示
          detailModalContainer.classList.add('hidden');
     }

    //閉じるボタンがクリックされたとき
    modalCloseButton.addEventListener('click', closeModal);
    detailModalCloseButton.addEventListener('click',closeModal)

    //キャンセルボタンがクリックされたとき
     modalCancelButton.addEventListener('click', closeModal);

   // モーダル外部クリックで閉じる
    window.addEventListener('click', function(event) {
       if(event.target === modalContainer || event.target === detailModalContainer) {
            closeModal();
        }
    });
   //編集ボタンをクリックした時の処理
   tableBody.addEventListener('click',function(event){
       if(event.target.classList.contains('edit-button')){
         const operatorId =  parseInt(event.target.getAttribute('data-id'));
         const operator = operators.find(operator => operator.id === operatorId);
             if(operator){
                 modalTitle.textContent = 'オペレーター情報編集';
                 editOperatorIdInput.value = operator.id;
                 editAffiliationSelect.value = operator.affiliation;
                  editOperatorNameInput.value = operator.name;
                   authorityLevelSelect.value = operator.authorityLevel;
                 modalContainer.classList.remove('hidden'); // モーダルを表示
                  authorityLevelSelect.closest('div').classList.remove('hidden');
             }
       }
          if(event.target.tagName === 'A'){
          const operatorId = parseInt(event.target.getAttribute('data-id'));
             const operator = operators.find(operator => operator.id === operatorId);
            if(operator){
             detailModalContainer.classList.remove('hidden')
               detailModalContent.innerHTML = `
                <p><strong>オペレーターID:</strong> ${operator.id}</p>
               <p><strong>オペレーター名:</strong> ${operator.name}</p>
                 <p><strong>所属:</strong> ${operator.affiliation}</p>
                <p><strong>ステータス:</strong> ${operator.status}</p>
                <p><strong>最終ログイン日時:</strong> ${operator.lastLogin}</p>
                 <p><strong>登録日時:</strong> ${operator.registrationDate}</p>
                   <p><strong>更新日時:</strong> ${operator.updateDate}</p>
               `
              }
       }
   });
     // フォームの送信処理
    modalForm.addEventListener('submit', function(event){
          event.preventDefault();
         const formData = new FormData(modalForm);
         //formDataから値を取得
           const operatorName = formData.get('editOperatorName');
           const affiliation = formData.get('editAffiliation');
           const operatorId = formData.get('editOperatorId')
            const authorityLevel = formData.get('authorityLevel');
         // ここにフォームの送信処理を記述（API連携など）
         console.log({operatorName:operatorName,affiliation:affiliation,operatorId:operatorId,authorityLevel:authorityLevel});
         closeModal();// モーダルを閉じる
          modalForm.reset(); //フォームをリセット
           generateTableRows();//テーブルの再描画
            updatePagination();
    });
 });