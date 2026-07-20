// shared/firebase.js
// Firebase の初期化と、よく使うデータアクセスAPIをまとめたモジュール。
// 各画面（index / draw / dressup / room / game）はこのモジュールを import して使う。
//
// 【重要】firebaseConfig はあなたのプロジェクトのものに置き換えてください。
// Firebaseコンソール → プロジェクトの設定 → 全般 → マイアプリ → SDK設定 の「構成」からコピーできます。
// このapiKeyは公開して問題ない種類です（アクセス制御はFirestoreのセキュリティルール側で行います）。

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
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
