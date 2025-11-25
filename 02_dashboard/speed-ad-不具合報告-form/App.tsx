import React, { useState, ChangeEvent, FormEvent } from 'react';
import { ReportType, Severity, BugCategory, FormData, FormErrors } from './types';
import { 
    REPORT_TYPE_OPTIONS, BUG_CATEGORY_OPTIONS, SEVERITY_OPTIONS, DEVICE_OPTIONS, 
    OS_OPTIONS, BROWSER_OPTIONS, AFFECTED_SCREEN_OPTIONS, AFFECTED_MODULE_OPTIONS,
    GOOGLE_FORM_RESPONSE_URL, GOOGLE_FORM_ENTRY_MAP
} from './constants';
import FormField from './components/FormField';
import RadioGroup from './components/RadioGroup';
import { SpinnerIcon, AlertTriangleIcon, CheckCircleIcon, UploadCloudIcon, FileIcon, XIcon } from './components/icons';

const App: React.FC = () => {
  const initialFormData: FormData = {
    reportType: ReportType.Simple,
    reporterName: '',
    reporterEmail: '',
    reporterCompany: '',
    occurrenceDate: '',
    occurrenceTime: '',
    device: '',
    deviceName: '',
    deviceOther: '',
    os: '',
    osOther: '',
    browser: '',
    browserVersion: '',
    browserOther: '',
    speedAdEnvironment: '',
    speedAdEnvironmentOther: '',
    bugCategory: '',
    bugSummary: '',
    questionnaireId: '',
    reproductionSteps: '',
    screenshot: '',
    screenshotFilename: '',
    expectedBehavior: '',
    actualBehavior: '',
    hasErrorMessage: false,
    errorMessage: '',
    internalProjectId: '',
    affectedModule: '',
    affectedModuleOther: '',
    severity: '',
    internalNotes: '',
    assigneeSuggestion: '',
  };

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
        setFormData((prev) => {
            const newFormData = { ...prev, [name]: value };
            if (name === 'device' && value !== 'other') newFormData.deviceOther = '';
            if (name === 'os' && value !== 'other') newFormData.osOther = '';
            if (name === 'browser' && value !== 'other') newFormData.browserOther = '';
            if (name === 'speedAdEnvironment' && value !== 'other') newFormData.speedAdEnvironmentOther = '';
            if (name === 'affectedModule' && value !== 'other') newFormData.affectedModuleOther = '';
            if (name === 'reportType') {
                // When switching to simple report, clear detailed-only fields
                if (value === ReportType.Simple) {
                    return {
                        ...newFormData,
                        reporterName: '', reporterEmail: '', reporterCompany: '',
                        occurrenceDate: '', occurrenceTime: '', device: '', deviceOther: '',
                        os: '', osOther: '', browser: '', browserOther: '',
                        speedAdEnvironment: '', speedAdEnvironmentOther: '',
                        expectedBehavior: '', hasErrorMessage: false, errorMessage: '',
                        internalProjectId: '', affectedModule: '', affectedModuleOther: '',
                        severity: '', internalNotes: '', assigneeSuggestion: '',
                        deviceName: '', browserVersion: '', screenshot: '', screenshotFilename: '',
                    };
                }
            }
            return newFormData;
        });
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setErrors(prev => ({...prev, screenshot: undefined}));

      if (!file) {
          return;
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
          setErrors(prev => ({...prev, screenshot: 'ファイルサイズは5MBを超えることはできません。'}));
          e.target.value = ''; // Reset file input
          return;
      }

      if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
          setErrors(prev => ({...prev, screenshot: 'PNG, JPG, GIF形式の画像のみアップロードできます。'}));
          e.target.value = ''; // Reset file input
          return;
      }

      const reader = new FileReader();
      reader.onload = () => {
          setFormData(prev => ({
              ...prev,
              screenshot: reader.result as string,
              screenshotFilename: file.name
          }));
      };
      reader.onerror = () => {
           setErrors(prev => ({...prev, screenshot: 'ファイルの読み込みに失敗しました。'}));
      }
      reader.readAsDataURL(file);
  };

  const clearScreenshot = () => {
      setFormData(prev => ({
          ...prev,
          screenshot: '',
          screenshotFilename: ''
      }));
      const fileInput = document.getElementById('screenshot-upload') as HTMLInputElement;
      if (fileInput) {
          fileInput.value = '';
      }
  };


  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Common validations
    if (!formData.bugCategory) newErrors.bugCategory = '不具合の種別は必須です。';
    if (!formData.bugSummary.trim()) newErrors.bugSummary = '不具合の概要は必須です。';
    if (!formData.reproductionSteps.trim()) newErrors.reproductionSteps = '再現手順は必須です。';
    if (!formData.actualBehavior.trim()) newErrors.actualBehavior = '実際の動作は必須です。';
    
    // Detailed report validations
    if (formData.reportType === ReportType.Detailed) {
        if (!formData.expectedBehavior.trim()) newErrors.expectedBehavior = '期待される動作は必須です。';
        if (formData.hasErrorMessage && !formData.errorMessage.trim()) newErrors.errorMessage = 'エラーメッセージの内容を記載してください。';

        if (formData.device === 'other' && !formData.deviceOther.trim()) newErrors.deviceOther = '利用デバイスを具体的に入力してください。';
        if (formData.os === 'other' && !formData.osOther.trim()) newErrors.osOther = 'OSを具体的に入力してください。';
        if (formData.browser === 'other' && !formData.browserOther.trim()) newErrors.browserOther = 'ブラウザ名を具体的に入力してください。';
        if (formData.speedAdEnvironment === 'other' && !formData.speedAdEnvironmentOther.trim()) newErrors.speedAdEnvironmentOther = '利用画面を具体的に入力してください。';
        if (formData.affectedModule === 'other' && !formData.affectedModuleOther.trim()) newErrors.affectedModuleOther = '影響を受けるモジュール/機能を具体的に入力してください。';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors(prev => ({ ...prev, form: undefined, screenshot: undefined }));

    const iframeName = `hidden_iframe_${new Date().getTime()}`;
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.id = iframeName;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.action = GOOGLE_FORM_RESPONSE_URL;
    form.method = 'POST';
    form.target = iframeName;
    
    const appendInput = (name: string, value: string) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    };

    const appendParam = (key: keyof typeof GOOGLE_FORM_ENTRY_MAP, value: string) => {
        if (typeof value === 'string' && value && GOOGLE_FORM_ENTRY_MAP[key]) {
            appendInput(GOOGLE_FORM_ENTRY_MAP[key], value);
        }
    };

    const getSelectValueAsText = (
        fieldKey: keyof FormData,
        otherFieldKey: keyof FormData,
        options: { value: string; label: string }[]
    ): string => {
        const value = formData[fieldKey] as string;
        if (value === 'other') {
            return formData[otherFieldKey] as string;
        }
        const option = options.find(o => o.value === value);
        return option ? option.label : '';
    };

    const reportTypeLabel = REPORT_TYPE_OPTIONS.find(o => o.value === formData.reportType)?.label;
    appendParam('reportType', reportTypeLabel || formData.reportType);

    const bugCategoryLabel = BUG_CATEGORY_OPTIONS.find(o => o.value === formData.bugCategory)?.label;
    appendParam('bugCategory', bugCategoryLabel || formData.bugCategory);
    
    appendParam('bugSummary', formData.bugSummary);
    appendParam('questionnaireId', formData.questionnaireId);
    appendParam('reproductionSteps', formData.reproductionSteps);
    appendParam('actualBehavior', formData.actualBehavior);

    if (formData.reportType === ReportType.Detailed) {
        appendParam('reporterName', formData.reporterName);
        appendParam('reporterEmail', formData.reporterEmail);
        appendParam('reporterCompany', formData.reporterCompany);

        if (formData.occurrenceDate && formData.occurrenceTime) {
            appendParam('occurrenceDateTime', `${formData.occurrenceDate} ${formData.occurrenceTime}`);
        } else if (formData.occurrenceDate) {
            appendParam('occurrenceDateTime', formData.occurrenceDate);
        } else {
             appendParam('occurrenceDateTime', '');
        }

        appendParam('device', getSelectValueAsText('device', 'deviceOther', DEVICE_OPTIONS));
        appendParam('deviceName', formData.deviceName);
        appendParam('os', getSelectValueAsText('os', 'osOther', OS_OPTIONS));
        const browserText = getSelectValueAsText('browser', 'browserOther', BROWSER_OPTIONS);
        appendParam('browser', browserText);
        appendParam('browserVersion', formData.browserVersion);
        appendParam('speedAdEnvironment', getSelectValueAsText('speedAdEnvironment', 'speedAdEnvironmentOther', AFFECTED_SCREEN_OPTIONS));
        
        appendParam('expectedBehavior', formData.expectedBehavior);
        
        appendParam('errorMessage', formData.hasErrorMessage ? formData.errorMessage : '');

        appendParam('screenshot', formData.screenshot);
        appendParam('screenshotFilename', formData.screenshotFilename);
        
        appendParam('internalProjectId', formData.internalProjectId);
        
        appendParam('affectedModule', getSelectValueAsText('affectedModule', 'affectedModuleOther', AFFECTED_MODULE_OPTIONS));

        const severityLabel = SEVERITY_OPTIONS.find(o => o.value === formData.severity)?.label;
        appendParam('severity', severityLabel || (formData.severity as string));
        
        appendParam('internalNotes', formData.internalNotes);
        appendParam('assigneeSuggestion', formData.assigneeSuggestion);
    }
    
    document.body.appendChild(form);

    const timeout = setTimeout(() => {
        setIsSubmitting(false);
        setErrors(prev => ({...prev, form: '送信がタイムアウトしました。インターネット接続を確認し、再度お試しください。'}));
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        if (document.body.contains(form)) document.body.removeChild(form);
    }, 15000);

    iframe.onload = () => {
        clearTimeout(timeout);
        setIsSubmitting(false);
        setIsSubmitted(true);
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        if (document.body.contains(form)) document.body.removeChild(form);
    };
    
    form.submit();
  };
  
  const resetForm = () => {
    setFormData(initialFormData);
    setErrors({});
  }

  const handleNewReport = () => {
    setIsSubmitted(false);
    resetForm();
  }

  if (isSubmitted) {
      return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden text-center py-16 px-8">
                <CheckCircleIcon className="w-16 h-16 mx-auto text-green-500" />
                <h2 className="mt-6 text-3xl font-extrabold text-slate-900">ご報告ありがとうございました！</h2>
                <p className="mt-3 text-lg text-slate-600">
                    ご報告内容を送信しました。サービス改善にご協力いただき、誠にありがとうございます。
                </p>
                <button
                    type="button"
                    onClick={handleNewReport}
                    className="mt-10 inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    別の不具合を報告する
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-8">
          <header className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold text-slate-900">SPEED AD 不具合報告フォーム</h1>
            <p className="mt-2 text-slate-600">
              サービスの品質向上のため、不具合のご報告にご協力をお願いいたします。
            </p>
          </header>

          <form onSubmit={handleSubmit} noValidate>
            <section className="mb-10 p-6 border border-slate-300 rounded-lg">
              <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">報告タイプ</h2>
              <RadioGroup
                legend="報告の種類を選択してください"
                name="reportType"
                options={REPORT_TYPE_OPTIONS}
                selectedValue={formData.reportType}
                onChange={handleInputChange}
                required
              />
               <p className="mt-3 text-sm text-slate-500">
                {formData.reportType === ReportType.Simple
                  ? '「簡易報告」では、必要最低限の情報で素早く報告できます。'
                  : '「詳細報告」では、発生環境や期待される動作など、より詳細な情報を提供いただけます。'}
              </p>
            </section>
            
            <section className="mb-10 p-6 border border-slate-300 rounded-lg">
              <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">不具合の内容</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField as="select" id="bugCategory" label="不具合の種別" options={BUG_CATEGORY_OPTIONS} value={formData.bugCategory} onChange={handleInputChange} required error={errors.bugCategory} />
                    <FormField as="textarea" id="bugSummary" label="不具合の概要" value={formData.bugSummary} onChange={handleInputChange} required placeholder="どのような不具合か簡潔に記述してください" error={errors.bugSummary} />
                </div>
                <div className="mt-6">
                    <FormField id="questionnaireId" label="アンケートID / URL (任意)" value={formData.questionnaireId} onChange={handleInputChange} placeholder="不具合が発生したアンケートのIDやURLを記載してください" error={errors.questionnaireId} />
                </div>
                <div className="mt-6">
                    <FormField as="textarea" id="reproductionSteps" label="不具合の再現手順" value={formData.reproductionSteps} onChange={handleInputChange} required placeholder={`具体的なステップを箇条書きで記述してください。
例:
1. 〜をクリックし、
2. 〜を入力すると、
3. 〜になる。`} error={errors.reproductionSteps} rows={6} />
                    <FormField as="textarea" id="actualBehavior" label="実際の動作" value={formData.actualBehavior} onChange={handleInputChange} required placeholder="不具合発生時の実際の動作を記述してください。" error={errors.actualBehavior} />
                </div>
            </section>
            
            {formData.reportType === ReportType.Detailed && (
              <div className="transition-all duration-500 ease-in-out">
                <section className="mb-10 p-6 border border-slate-300 rounded-lg">
                  <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">報告者情報 (任意)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField id="reporterName" label="氏名" value={formData.reporterName} onChange={handleInputChange} />
                    <FormField id="reporterEmail" label="メールアドレス" type="email" value={formData.reporterEmail} onChange={handleInputChange} hint="フィードバックをご希望の場合にご入力ください。" />
                  </div>
                  <FormField id="reporterCompany" label="会社名／所属" value={formData.reporterCompany} onChange={handleInputChange} />
                </section>
                
                <section className="mb-10 p-6 border border-slate-300 rounded-lg">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">不具合の発生状況 (詳細)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <FormField id="occurrenceDate" label="不具合の発生日 (任意)" type="date" value={formData.occurrenceDate} onChange={handleInputChange} error={errors.occurrenceDate} />
                        <FormField id="occurrenceTime" label="不具合の発生時刻 (任意)" type="time" value={formData.occurrenceTime} onChange={handleInputChange} error={errors.occurrenceTime} />
                    </div>
                    
                    <h3 className="text-lg font-semibold text-slate-700 mb-3">発生環境 (任意)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div>
                          <FormField as="select" id="device" label="利用デバイス" options={DEVICE_OPTIONS} value={formData.device} onChange={handleInputChange} />
                           {formData.device === 'other' && (
                              <div className="mt-4"><FormField id="deviceOther" label="利用デバイス (その他)" value={formData.deviceOther} onChange={handleInputChange} required placeholder="具体的なデバイス名" error={errors.deviceOther} /></div>
                          )}
                          <div className="mt-4">
                            <FormField id="deviceName" label="機種名・シリーズ名 (任意)" value={formData.deviceName} onChange={handleInputChange} placeholder="例: iPhone 15 Pro, Pixel 8" />
                          </div>
                       </div>
                       <div>
                          <FormField as="select" id="browser" label="ブラウザ名" options={BROWSER_OPTIONS} value={formData.browser} onChange={handleInputChange} />
                           {formData.browser === 'other' && (
                              <div className="mt-4"><FormField id="browserOther" label="ブラウザ名 (その他)" value={formData.browserOther} onChange={handleInputChange} required placeholder="具体的なブラウザ名" error={errors.browserOther} /></div>
                          )}
                          <div className="mt-4">
                             <FormField id="browserVersion" label="ブラウザのバージョン (任意)" value={formData.browserVersion} onChange={handleInputChange} placeholder="例: 125.0.6422.112" />
                          </div>
                       </div>
                       <div>
                           <FormField as="select" id="os" label="OS" options={OS_OPTIONS} value={formData.os} onChange={handleInputChange} error={errors.os} />
                           {formData.os === 'other' && (
                              <div className="mt-4"><FormField id="osOther" label="OS (その他)" value={formData.osOther} onChange={handleInputChange} required placeholder="具体的なOS名" error={errors.osOther} /></div>
                           )}
                       </div>
                       <div>
                           <FormField as="select" id="speedAdEnvironment" label="SPEED ADの利用画面" options={AFFECTED_SCREEN_OPTIONS} value={formData.speedAdEnvironment} onChange={handleInputChange} error={errors.speedAdEnvironment} />
                            {formData.speedAdEnvironment === 'other' && (
                               <div className="mt-4"><FormField id="speedAdEnvironmentOther" label="利用画面 (その他)" value={formData.speedAdEnvironmentOther} onChange={handleInputChange} required placeholder="具体的な利用画面" error={errors.speedAdEnvironmentOther} /></div>
                           )}
                       </div>
                    </div>

                    <div className="mt-6">
                        <FormField as="textarea" id="expectedBehavior" label="期待される動作" value={formData.expectedBehavior} onChange={handleInputChange} required placeholder="不具合がない場合に期待される動作を記述してください。" error={errors.expectedBehavior} />
                    </div>
                    
                    <div className="mt-6">
                        <label className="block text-sm font-medium text-slate-700">エラーメッセージの有無</label>
                        <div className="mt-2 flex items-center">
                            <input id="hasErrorMessage" name="hasErrorMessage" type="checkbox" checked={formData.hasErrorMessage} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <label htmlFor="hasErrorMessage" className="ml-2 text-sm text-slate-700">エラーメッセージが表示された</label>
                        </div>
                    </div>
                    
                    {formData.hasErrorMessage && (
                        <div className="mt-4 transition-all duration-300 ease-in-out">
                            <FormField as="textarea" id="errorMessage" label="エラーメッセージの内容" value={formData.errorMessage} onChange={handleInputChange} placeholder="表示されたエラーメッセージの全文を記載してください。" required error={errors.errorMessage} />
                        </div>
                    )}

                    <div className="mt-6">
                      <label className="block text-sm font-medium text-slate-700">スクリーンショット (任意)</label>
                      {!formData.screenshot ? (
                        <div className="mt-2 flex justify-center rounded-lg border border-dashed border-slate-900/25 px-6 py-10">
                          <div className="text-center">
                            <UploadCloudIcon className="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
                            <div className="mt-4 flex text-sm leading-6 text-slate-600">
                              <label htmlFor="screenshot-upload" className="relative cursor-pointer rounded-md bg-white font-medium text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:text-blue-500">
                                <span>ファイルを選択</span>
                                <input id="screenshot-upload" name="screenshot-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" />
                              </label>
                              <p className="pl-1">またはドラッグ&ドロップ</p>
                            </div>
                            <p className="text-xs leading-5 text-slate-600">PNG, JPG, GIF形式 (5MBまで)</p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center truncate">
                              <FileIcon className="h-5 w-5 flex-shrink-0 text-slate-400" />
                              <span className="ml-2 truncate text-sm font-medium text-slate-900">{formData.screenshotFilename}</span>
                            </div>
                            <button type="button" onClick={clearScreenshot} className="ml-2 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-transparent text-slate-400 hover:bg-slate-200 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" aria-label="スクリーンショットを削除">
                               <XIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      )}
                      {errors.screenshot && <p className="mt-2 text-xs text-red-600">{errors.screenshot}</p>}
                    </div>

                </section>
              
                <section className="mb-10 p-6 bg-blue-50 border border-blue-200 rounded-lg transition-all duration-500 ease-in-out">
                  <h2 className="text-xl font-bold text-blue-900 mb-4 border-b border-blue-300 pb-2 flex items-center">
                      <AlertTriangleIcon className="w-5 h-5 mr-2 text-blue-700"/> 管理情報 (詳細報告用)
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField id="internalProjectId" label="関連プロジェクトID (任意)" value={formData.internalProjectId} onChange={handleInputChange} placeholder="例: GA-1234" />
                    <div>
                      <FormField as="select" id="affectedModule" label="影響を受けるモジュール/機能 (任意)" options={AFFECTED_MODULE_OPTIONS} value={formData.affectedModule} onChange={handleInputChange} />
                      {formData.affectedModule === 'other' && (
                          <div className="mt-4">
                              <FormField id="affectedModuleOther" label="影響を受けるモジュール (その他)" value={formData.affectedModuleOther} onChange={handleInputChange} required placeholder="具体的なモジュール名" error={errors.affectedModuleOther} />
                          </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-6">
                    <RadioGroup legend="深刻度 (任意)" name="severity" options={SEVERITY_OPTIONS} selectedValue={formData.severity} onChange={handleInputChange} error={errors.severity} />
                  </div>
                  <div className="mt-6">
                    <FormField as="textarea" id="internalNotes" label="社内メモ (任意)" value={formData.internalNotes} onChange={handleInputChange} placeholder={`顧客からの問い合わせ内容、経緯などを記載します。
例：
・2024/05/15 14:30 〇〇様より電話
・キャンペーン設定画面で保存ができない
・...`} rows={6} />
                    <FormField id="assigneeSuggestion" label="担当者候補 (任意)" value={formData.assigneeSuggestion} onChange={handleInputChange} placeholder="担当部署や担当者の名前" />
                  </div>
                </section>
              </div>
            )}

            <footer className="mt-10 pt-6 border-t border-slate-200">
              <div className="text-xs text-slate-500 mb-6">
                <p>ご入力いただいた個人情報は、お問い合わせへの回答およびサービス改善の目的でのみ利用いたします。詳細は<a href="https://www.abroad-o.com/rule.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">プライバシーポリシー</a>をご確認ください。</p>
              </div>
               {errors.form && (
                  <div className="mb-4 text-center text-red-600 bg-red-100 p-3 rounded-md text-sm">
                      {errors.form}
                  </div>
              )}
              <div className="flex justify-end">
                <button type="submit" disabled={isSubmitting} className="w-full md:w-auto inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors">
                  {isSubmitting ? (
                    <>
                        <SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                        処理中...
                    </>
                  ) : '同意して報告する'}
                </button>
              </div>
            </footer>
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;