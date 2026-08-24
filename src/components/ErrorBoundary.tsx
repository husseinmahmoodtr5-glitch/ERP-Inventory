import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Terminal } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // تحديث الحالة لكي يُظهر العرض (Render) الواجهة البديلة
    return { hasError: true, error, errorInfo: null, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // تسجيل الخطأ في الـ Console لتتبعه لاحقاً
    console.error('تم التقاط خطأ بواسطة ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    // إعادة تحميل الصفحة بالكامل لمحاولة مسح الخطأ
    window.location.reload();
  };

  private toggleDetails = () => {
    this.setState((prevState) => ({ showDetails: !prevState.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-8 text-center overflow-hidden">
            <div className="mx-auto bg-rose-100 text-rose-600 w-20 h-20 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle size={40} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">عذراً، حدث خطأ غير متوقع في هذه الشاشة</h1>
            <p className="text-slate-500 mb-8">
              قمنا بإيقاف هذا الجزء من النظام مؤقتاً لمنع انهيار البرنامج وفقدان البيانات. يرجى محاولة إعادة تحميل الصفحة.
            </p>

            <div className="flex justify-center gap-4 mb-8">
              <button
                onClick={this.handleReload}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md"
              >
                <RefreshCcw size={18} />
                إعادة تحميل النظام
              </button>
              <button
                onClick={this.toggleDetails}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
              >
                <Terminal size={18} />
                {this.state.showDetails ? 'إخفاء التفاصيل الفنية' : 'عرض التفاصيل الفنية'}
              </button>
            </div>

            {this.state.showDetails && (
              <div className="text-left bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-sm overflow-x-auto border border-slate-700 max-h-64 overflow-y-auto w-full shadow-inner">
                <p className="font-bold text-rose-400 mb-2">{this.state.error?.toString()}</p>
                <pre className="whitespace-pre-wrap leading-relaxed">{this.state.errorInfo?.componentStack}</pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;