// shared/firebase.js
// Firebase の初期化と、よく使うデータアクセスAPIをまとめたモジュール。
// 各画面（index / draw / dressup / room / game）はこのモジュールを import して使う。
//
// 【重要】firebaseConfig はあなたのプロジェクトのものに置き換えてください。
// Firebaseコンソール → プロジェクトの設定 → 全般 → マイアプリ → SDK設定 の「構成」からコピーできます。
// このapiKeyは公開して問題ない種類です（アクセス制御はFirestoreのセキュリティルール側で行います）。

export const firebaseConfig = {
  apiKey: "AIzaSyD9QLN8R_Io5yiNBpb74w3KCM4kkQijsPU",
  authDomain: "dressup-avatars.firebaseapp.com",
  projectId: "dressup-avatars",
  storageBucket: "dressup-avatars.firebasestorage.app",
  messagingSenderId: "875993188844",
  appId: "1:875993188844:web:01da8d07ca4c69eec518c9"
};

export const COLLECTION_NAME = 'dressup_avatars';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, where, limit, getDocs, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const isConfigured = !Object.values(firebaseConfig).some(v => String(v).includes('YOUR_'));

let _db = null;
if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    _db = getFirestore(app);
  } catch (err) {
    console.error('Firebase init error', err);
  }
}
export const db = _db;

// 生のFirestore APIも再エクスポート（画面側で細かい操作をしたい時用）
export {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, where, limit, getDocs, serverTimestamp
};

// ========================================================================
// 高レベルAPI
// ========================================================================

/**
 * アバターやアイテムを保存する。
 * @param {object} args
 * @param {string} args.imageData - PNG dataURL
 * @param {'avatar'|'item'|'look'|'madeup'} [args.type='avatar']
 * @param {object} [args.extra] - 追加フィールド（realisticImageDataなど）
 */
export async function saveAvatar({ imageData, type = 'avatar', extra = {} }) {
  if (!db) throw new Error('Firestoreが設定されていません');
  return await addDoc(collection(db, COLLECTION_NAME), {
    imageData,
    type,
    createdAt: serverTimestamp(),
    ...extra
  });
}

/**
 * アバター一覧をリアルタイム監視。
 * @param {(items: Array) => void} callback
 * @param {object} [options] - { type: 'avatar'|'item'|'look' } でフィルタ
 * @returns {() => void} 監視解除関数
 */
export function watchAvatars(callback, options = {}) {
  if (!db) { callback([]); return () => {}; }
  // type未設定の既存データも読めるようにするため、
  // フィルタなしで取得してからクライアント側で振り分ける方式にする。
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'asc'));
  return onSnapshot(q, snap => {
    let items = snap.docs.map(d => {
      const data = d.data() || {};
      if (!data.type) data.type = 'avatar'; // 互換性: 未設定は avatar 扱い
      return { id: d.id, ...data };
    });
    if (options.type) {
      items = items.filter(x => x.type === options.type);
    }
    callback(items);
  });
}

export async function deleteAvatar(id) {
  if (!db) throw new Error('Firestoreが設定されていません');
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

export async function updateAvatar(id, patch) {
  if (!db) throw new Error('Firestoreが設定されていません');
  await updateDoc(doc(db, COLLECTION_NAME, id), patch);
}

// ========================================================================
// フェーズ5: Gold 経済 - allowance アプリとの連携
// ========================================================================
// allowance は別 Firebase プロジェクトで動いているので、二重初期化で対応。
// Firestore 構造:
//   rpg-data / main / children.{childKey}.gold  <- ここを read/write する
// 【重要】以下のプレースホルダを allowance アプリの firebaseConfig に置き換えてください。
// allowance の HTML 冒頭にある firebaseConfig をそのままコピペで OK。

export const allowanceFirebaseConfig = {
  apiKey: "AIzaSyDEW-b_duuOBM3Ky3jZgtHy7wOFnOG3vm0",
  authDomain: "allowancerpg.firebaseapp.com",
  projectId: "allowancerpg",
  storageBucket: "allowancerpg.firebasestorage.app",
  messagingSenderId: "604762397893",
  appId: "1:604762397893:web:42e547756cf203677224ac",
  measurementId: "G-EP49307MM8"
};

import { runTransaction, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const isAllowanceConfigured =
  !Object.values(allowanceFirebaseConfig).some(v => String(v).includes('YOUR_'));

const ALLOWANCE_DOC = { collection: 'rpg-data', doc: 'main' };
const LS_KEY_CHILD = 'avatarApp_allowanceChildKey_v1';

let _allowanceDb = null;
if (isAllowanceConfigured) {
  try {
    // 名前を付けて別インスタンスとして初期化（既存のアバターアプリの app と競合しない）
    const app = initializeApp(allowanceFirebaseConfig, 'allowance');
    _allowanceDb = getFirestore(app);
  } catch (err) {
    console.error('Allowance Firebase init error', err);
  }
}
export const allowanceDb = _allowanceDb;

/** localStorage に保存された childKey を返す（未選択なら null） */
export function getStoredChildKey() {
  try { return localStorage.getItem(LS_KEY_CHILD) || null; } catch (e) { return null; }
}

/** childKey を localStorage に保存 */
export function setStoredChildKey(key) {
  try {
    if (key) localStorage.setItem(LS_KEY_CHILD, key);
    else localStorage.removeItem(LS_KEY_CHILD);
  } catch (e) { /* ignore */ }
}

/**
 * allowance の main ドキュメント全体をリアルタイム監視。
 * @param {(data: object|null) => void} callback
 * @returns {() => void} 監視解除関数
 */
export function watchAllowance(callback) {
  if (!allowanceDb) { callback(null); return () => {}; }
  const ref = doc(allowanceDb, ALLOWANCE_DOC.collection, ALLOWANCE_DOC.doc);
  return onSnapshot(ref, snap => {
    callback(snap.exists() ? snap.data() : null);
  }, err => {
    console.error('watchAllowance error', err);
    callback(null);
  });
}

/**
 * children のリストを配列で返す（picker 用）。
 * childOrder があればその順序、無ければオブジェクトキー順。
 * @returns {Promise<Array<{key: string, name: string, avatar: string, gold: number}>>}
 */
export async function listAllowanceChildren() {
  if (!allowanceDb) return [];
  const ref = doc(allowanceDb, ALLOWANCE_DOC.collection, ALLOWANCE_DOC.doc);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data();
  const children = data.children || {};
  const order = Array.isArray(data.childOrder) && data.childOrder.length > 0
    ? data.childOrder
    : Object.keys(children);
  return order
    .filter(k => children[k])
    .map(k => ({
      key: k,
      name: children[k].name || '（なまえなし）',
      avatar: children[k].avatar || '🧒',
      gold: children[k].gold || 0
    }));
}

/**
 * gold を加算（またはマイナス値で減算）。history に自動でエントリ追加。
 * atomic なトランザクションで残高不足チェックを含む。
 * @param {string} childKey
 * @param {number} delta - 加算量（マイナス可）
 * @param {object} entry - { type, name }
 * @returns {Promise<number>} 更新後の gold 残高
 */
export async function adjustGold(childKey, delta, entry) {
  if (!allowanceDb) throw new Error('allowance 未設定');
  if (!childKey) throw new Error('childKey が未指定');
  if (!Number.isFinite(delta) || delta === 0) return 0;
  const ref = doc(allowanceDb, ALLOWANCE_DOC.collection, ALLOWANCE_DOC.doc);
  let newGold = 0;
  await runTransaction(allowanceDb, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('allowance データが見つかりません');
    const d = snap.data();
    const child = (d.children || {})[childKey];
    if (!child) throw new Error('このお子さんの データがない みたい');
    const cur = child.gold || 0;
    if (delta < 0 && cur + delta < 0) {
      throw new Error('gold が たりないよ');
    }
    newGold = cur + delta;
    const historyEntry = {
      id: Date.now(),
      type: entry?.type || 'avatarApp',
      name: entry?.name || (delta >= 0 ? '💰 ゴールド獲得' : '💸 ゴールド消費'),
      gold: delta,
      timestamp: Date.now()
    };
    const history = Array.isArray(child.history) ? child.history : [];
    // 履歴は allowance 側の慣習で最大 100 件くらいに丸めるのが安全
    const newHistory = [historyEntry, ...history].slice(0, 200);
    tx.update(ref, {
      [`children.${childKey}.gold`]: newGold,
      [`children.${childKey}.history`]: newHistory
    });
  });
  return newGold;
}

/** gold を稼ぐ（薄いラッパー） */
export function earnGold(childKey, amount, name) {
  return adjustGold(childKey, Math.abs(amount), { type: 'avatarAppEarn', name: `💰 ${name}` });
}

/** gold を使う */
export function spendGold(childKey, amount, name) {
  return adjustGold(childKey, -Math.abs(amount), { type: 'avatarAppSpend', name: `🛒 ${name}` });
}

/**
 * 汎用: allowance のドキュメントの任意フィールドを更新。
 * lastFullCareGoldAt / avatarAppUnlockedFurniture 等の管理用。
 */
export async function updateAllowanceChild(childKey, patch) {
  if (!allowanceDb) throw new Error('allowance 未設定');
  const ref = doc(allowanceDb, ALLOWANCE_DOC.collection, ALLOWANCE_DOC.doc);
  const flat = {};
  for (const [k, v] of Object.entries(patch)) {
    flat[`children.${childKey}.${k}`] = v;
  }
  await updateDoc(ref, flat);
}
