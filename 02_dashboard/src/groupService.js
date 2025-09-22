import { resolveDashboardDataPath } from './utils.js';

let groups = []; // メモリ上のグループデータ

/**
 * グループデータをフェッチする。
 * 現時点では静的JSONファイルから読み込む。
 * @returns {Promise<Array>} グループデータの配列
 */
export async function fetchGroups() {
    const isSamplePage = window.location.pathname.includes('/sample/');
    const dataFile = isSamplePage ? 'core/groups.sample.json' : 'core/groups.json';
    const dataPath = resolveDashboardDataPath(dataFile);

    try {
        const response = await fetch(dataPath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        groups = await response.json();
        return groups;
    } catch (error) {
        console.error('Error fetching groups data:', error);
        return [];
    }
}

/**
 * 新しいグループを作成する。
 * @param {object} newGroupData 新しいグループのデータ
 * @returns {Promise<object>} 作成されたグループデータ
 */
export async function createGroup(newGroupData) {
    // IDを生成 (簡易的な例)
    const newId = `grp_${Date.now()}`;
    const groupToSave = { ...newGroupData, id: newId };
    groups.push(groupToSave);
    // TODO: 実際にはサーバーサイドAPIを呼び出す
    
    return groupToSave;
}

/**
 * 既存のグループを更新する。
 * @param {string} groupId 更新するグループのID
 * @param {object} updatedGroupData 更新されたグループのデータ
 * @returns {Promise<object|null>} 更新されたグループデータ、または見つからない場合はnull
 */
export async function updateGroup(groupId, updatedGroupData) {
    const index = groups.findIndex(g => g.id === groupId);
    if (index !== -1) {
        groups[index] = { ...groups[index], ...updatedGroupData };
        // TODO: 実際にはサーバーサイドAPIを呼び出す
        
        return groups[index];
    }
    return null;
}

/**
 * グループを削除する。
 * @param {string} groupId 削除するグループのID
 * @returns {Promise<boolean>} 削除が成功した場合はtrue、それ以外はfalse
 */
export async function deleteGroup(groupId) {
    const initialLength = groups.length;
    groups = groups.filter(g => g.id !== groupId);
    // TODO: 実際にはサーバーサイドAPIを呼び出す
    
    return groups.length < initialLength;
}

/**
 * 現在メモリ上にあるグループデータを取得する。
 * @returns {Array} グループデータの配列
 */
export function getGroupsInMemory() {
    return groups;
}
