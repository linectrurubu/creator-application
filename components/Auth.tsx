
import React, { useState, useEffect } from 'react';
import { UserRole, UserStatus } from '../types';
import { signIn, signUp, resetPassword } from '../services';
import { CheckCircle, AlertCircle, Loader2, Building2, User as UserIcon, ArrowLeft, Mail, LogIn, Download } from 'lucide-react';

interface AuthProps {
  onLogin: (email: string, role: UserRole) => void;
  onRegister: (data: any) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';

// URLからクエリパラメータを取得
const getUrlParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    mode: params.get('mode'),
    name: params.get('name') || '',
    email: params.get('email') || '',
  };
};

export const Auth: React.FC<AuthProps> = ({ onLogin, onRegister }) => {
  // URLパラメータでmode=registerなら新規登録画面から開始
  const urlParams = getUrlParams();
  const [authMode, setAuthMode] = useState<AuthMode>(urlParams.mode === 'register' ? 'REGISTER' : 'LOGIN');

  // クリエイターポータルからの引き継ぎ情報
  const [creatorPortalData, setCreatorPortalData] = useState<{name: string; email: string} | null>(
    urlParams.name || urlParams.email ? { name: urlParams.name, email: urlParams.email } : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<(() => void) | null>(null);
  const [errorActionLabel, setErrorActionLabel] = useState<string | null>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhoneNumber, setRegPhoneNumber] = useState('');
  const [regPostalCode, setRegPostalCode] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regN8nUrl, setRegN8nUrl] = useState('');
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);
  const [isUrlValid, setIsUrlValid] = useState<boolean | null>(null);

  // Bank Info States
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountType, setAccountType] = useState('普通');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  // Invoice State
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Reset Password State
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const mapAuthError = (err: any) => {
      const code = err.code || '';
      const msg = err.message || '';
      console.log('Firebase Auth Error:', code, msg);
      
      // Reset actions
      setErrorAction(null);
      setErrorActionLabel(null);

      if (code === 'auth/email-already-in-use') {
          setErrorAction(() => () => {
             setAuthMode('LOGIN');
             setEmail(regEmail); // Pre-fill login email
             setError(null);
          });
          setErrorActionLabel('ログイン画面へ移動');
          return 'このメールアドレスは既に登録されています。';
      }
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
          return 'メールアドレスまたはパスワードが正しくありません。';
      }
      if (code === 'auth/weak-password') {
          return 'パスワードは6文字以上で設定してください。';
      }
      if (code === 'auth/too-many-requests') {
          return 'アクセスが集中しています。しばらく待ってから再度お試しください。';
      }
      if (code === 'auth/network-request-failed') {
          return 'ネットワークエラーが発生しました。接続を確認してください。';
      }
      if (code === 'auth/invalid-email') {
          return 'メールアドレスの形式が正しくありません。';
      }
      
      return 'エラーが発生しました: ' + (msg || code);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 共有テストアカウント: admin / pantheon
    if (email === 'admin' && password === 'pantheon') {
      onLogin('shared-admin', UserRole.ADMIN);
      return;
    }

    try {
        await signIn(email, password);
        // App.tsx onAuthStateChanged will handle the rest
    } catch (err: any) {
        console.error(err);
        setError(mapAuthError(err));
        setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate N8N URL always for Partners
    if (isUrlValid === false) return;
    
    setLoading(true);
    setError(null);

    // Bundle bank info
    const bankAccountInfo = JSON.stringify({
      bankName,
      branchName,
      accountType,
      accountNumber,
      accountHolder
    });

    const userData = {
      name: regName,
      phoneNumber: regPhoneNumber,
      postalCode: regPostalCode,
      address: regAddress,
      n8nProfileUrl: regN8nUrl,
      role: UserRole.PARTNER,
      status: UserStatus.PENDING,
      bankAccountInfo,
      invoiceNumber,
      avatarUrl: `https://ui-avatars.com/api/?name=${regName || 'U'}&background=random`
    };

    try {
        await signUp(regEmail, regPassword, userData);
        // App.tsx onAuthStateChanged will handle the rest
    } catch (err: any) {
        console.error(err);
        setError(mapAuthError(err));
        setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResetSuccess(false);
    try {
      await resetPassword(resetEmail);
      setResetSuccess(true);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        // Security: Don't reveal user existence, but for UX in this closed app we might be explicit
        // or just pretend it was sent. Let's show specific error for this requirement context.
        setError('このメールアドレスのアカウントは見つかりませんでした。');
      } else {
        setError(mapAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const checkN8nUrl = () => {
    if (!regN8nUrl) return;
    setIsCheckingUrl(true);
    setTimeout(() => {
      setIsCheckingUrl(false);
      const isValid = regN8nUrl.includes('n8n.io/creators/');
      setIsUrlValid(isValid);
    }, 1000);
  };

  // クリエイターポータルから情報を引き継ぐ
  const importFromCreatorPortal = () => {
    if (creatorPortalData) {
      setRegName(creatorPortalData.name);
      setRegEmail(creatorPortalData.email);
    }
  };

  const getTitle = () => {
    switch (authMode) {
      case 'LOGIN': return 'ログイン';
      case 'REGISTER': return 'パートナー新規登録';
      case 'FORGOT_PASSWORD': return 'パスワード再設定';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pantheon-navy p-4 font-sans">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden my-8">
        <div className="p-8 text-center bg-gray-50 border-b border-gray-100">
          <div className="w-12 h-12 bg-pantheon-navy text-white rounded-lg mx-auto flex items-center justify-center text-2xl font-bold mb-4">P</div>
          <h2 className="text-2xl font-bold text-gray-800">{getTitle()}</h2>
          <p className="text-gray-500 text-sm mt-2">Pantheon クリエイターマッチング</p>
        </div>

        <div className="p-8">
          {error && (
             <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex flex-col items-start gap-2 animate-in fade-in slide-in-from-top-2">
                 <div className="flex items-center">
                    <AlertCircle size={16} className="mr-2 shrink-0"/> <span>{error}</span>
                 </div>
                 {errorAction && errorActionLabel && (
                     <button 
                       onClick={errorAction}
                       className="text-xs font-bold text-red-800 hover:bg-red-100 px-3 py-1.5 rounded transition-colors flex items-center self-end"
                     >
                        {errorActionLabel} <LogIn size={12} className="ml-1"/>
                     </button>
                 )}
             </div>
          )}

          {authMode === 'LOGIN' && (
            <div className="space-y-6">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pantheon-navy focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pantheon-navy focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center text-gray-600">
                    <input type="checkbox" className="mr-2 rounded text-pantheon-navy focus:ring-pantheon-navy" />
                    ログイン状態を保持
                  </label>
                  <button type="button" onClick={() => { setAuthMode('FORGOT_PASSWORD'); setError(null); }} className="text-pantheon-navy hover:underline">パスワードをお忘れですか？</button>
                </div>

                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-pantheon-navy hover:bg-pantheon-light text-white font-bold py-3 rounded-lg transition-colors shadow-lg flex justify-center items-center"
                  >
                    {loading && <Loader2 className="animate-spin mr-2" size={18} />} ログイン
                  </button>
                </div>
              </form>
            </div>
          )}

          {authMode === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-6">

              {/* クリエイターポータルからの引き継ぎボタン */}
              {creatorPortalData && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-700 mb-3">
                    クリエイターポータルからの情報があります。
                  </p>
                  <button
                    type="button"
                    onClick={importFromCreatorPortal}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <Download size={18} />
                    クリエイターポータルから引き継ぐ
                  </button>
                  <p className="text-xs text-blue-600 mt-2 text-center">
                    氏名・メールアドレスが自動入力されます
                  </p>
                </div>
              )}

              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center border-b pb-2">
                   <UserIcon className="mr-2 text-pantheon-navy" size={20} /> 基本情報
                </h3>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">氏名 <span className="text-red-500">*</span></label>
                    <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-n8n-orange" placeholder="山田 太郎" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス <span className="text-red-500">*</span></label>
                  <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-n8n-orange" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">パスワード (6文字以上) <span className="text-red-500">*</span></label>
                  <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-n8n-orange" minLength={6} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">電話番号 <span className="text-red-500">*</span></label>
                    <input type="tel" value={regPhoneNumber} onChange={(e) => setRegPhoneNumber(e.target.value)} className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-n8n-orange" placeholder="090-1234-5678" required />
                </div>
                <div className="space-y-2">
                   <label className="block text-sm font-medium text-gray-700">住所 <span className="text-red-500">*</span></label>
                   <div className="grid grid-cols-3 gap-2">
                     <input type="text" value={regPostalCode} onChange={(e) => setRegPostalCode(e.target.value)} className="col-span-1 px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-n8n-orange" placeholder="〒" required />
                     <input type="text" value={regAddress} onChange={(e) => setRegAddress(e.target.value)} className="col-span-2 px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-n8n-orange" placeholder="住所" required />
                   </div>
                </div>

                {/* n8n URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">n8n公認クリエイターURL <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input 
                      type="url" 
                      value={regN8nUrl}
                      onChange={(e) => { setRegN8nUrl(e.target.value); setIsUrlValid(null); }}
                      onBlur={checkN8nUrl}
                      className={`w-full px-4 py-2 bg-white text-gray-900 border rounded-lg outline-none pr-10 focus:ring-2 ${isUrlValid === true ? 'border-green-500 focus:ring-green-500' : isUrlValid === false ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-n8n-orange'}`}
                      placeholder="https://n8n.io/creators/username"
                      required
                    />
                    <div className="absolute right-3 top-2.5">
                      {isCheckingUrl && <Loader2 className="animate-spin text-gray-400" size={20} />}
                      {!isCheckingUrl && isUrlValid === true && <CheckCircle className="text-green-500" size={20} />}
                      {!isCheckingUrl && isUrlValid === false && <AlertCircle className="text-red-500" size={20} />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bank & Invoice */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center border-b pb-2"><Building2 className="mr-2 text-pantheon-navy" size={20} /> 口座・インボイス</h3>
                <div className="grid grid-cols-2 gap-4">
                    <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="銀行名" className="px-4 py-2 border rounded-lg w-full bg-white text-gray-900" required />
                    <input type="text" value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="支店名" className="px-4 py-2 border rounded-lg w-full bg-white text-gray-900" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="口座番号" className="px-4 py-2 border rounded-lg w-full bg-white text-gray-900" required />
                    <input type="text" value={accountHolder} onChange={e => setAccountHolder(e.target.value)} placeholder="名義 (カナ)" className="px-4 py-2 border rounded-lg w-full bg-white text-gray-900" required />
                </div>
                <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="インボイス番号 (任意)" className="w-full px-4 py-2 border rounded-lg bg-white text-gray-900" />
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={loading || isUrlValid === false || isCheckingUrl}
                  className="w-full bg-n8n-orange hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg disabled:opacity-50 flex justify-center items-center"
                >
                  {loading && <Loader2 className="animate-spin mr-2" size={18} />} 
                  パートナー申請を行う
                </button>
              </div>
            </form>
          )}

          {authMode === 'FORGOT_PASSWORD' && (
            <div className="space-y-6">
              {!resetSuccess ? (
                <form onSubmit={handleResetSubmit} className="space-y-4">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    ご登録のメールアドレスを入力してください。<br/>
                    パスワード再設定用のリンクをお送りします。
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                    <input 
                      type="email" 
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pantheon-navy focus:border-transparent outline-none transition-all"
                      required
                      placeholder="example@pantheon.inc"
                    />
                  </div>
                  
                  <div className="pt-2">
                    <button 
                      type="submit"
                      disabled={loading || !resetEmail}
                      className="w-full bg-pantheon-navy hover:bg-pantheon-light text-white font-bold py-3 rounded-lg transition-colors shadow-lg flex justify-center items-center disabled:opacity-50"
                    >
                      {loading && <Loader2 className="animate-spin mr-2" size={18} />} 
                      <Mail size={18} className="mr-2" /> 送信する
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-6 bg-green-50 rounded-xl border border-green-100">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-green-800 mb-2">送信完了</h3>
                  <p className="text-sm text-green-700 mb-4 px-4">
                    {resetEmail} 宛にパスワード再設定用のメールを送信しました。メール内のリンクから手続きを進めてください。
                  </p>
                  <button 
                    onClick={() => { setAuthMode('LOGIN'); setResetEmail(''); setResetSuccess(false); setError(null); }}
                    className="text-sm font-bold text-green-700 hover:underline"
                  >
                    ログイン画面に戻る
                  </button>
                </div>
              )}

              {!resetSuccess && (
                <div className="text-center pt-2">
                  <button 
                    onClick={() => { setAuthMode('LOGIN'); setError(null); }}
                    className="text-sm text-gray-500 hover:text-pantheon-navy flex items-center justify-center mx-auto"
                  >
                    <ArrowLeft size={16} className="mr-1" /> ログイン画面に戻る
                  </button>
                </div>
              )}
            </div>
          )}

          {authMode !== 'FORGOT_PASSWORD' && (
            <div className="mt-6 text-center">
               <button 
                 onClick={() => { 
                   setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN');
                   setError(null);
                   setErrorAction(null);
                 }} 
                 className="text-sm text-gray-600 hover:text-pantheon-navy font-medium"
               >
                  {authMode === 'LOGIN' ? "アカウントをお持ちでない方はこちら（新規登録）" : "すでにアカウントをお持ちの方（ログイン）"}
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
