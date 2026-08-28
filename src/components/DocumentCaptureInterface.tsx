import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Upload,
  Camera,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader,
  Eye,
  EyeOff,
  User,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

type DocumentType = 'aadhaar' | 'pan' | 'license' | 'passport' | 'visa' | null;
type AppView = 'signup' | 'verify-code' | 'dashboard';

interface UploadState {
  file: File | null;
  preview: string | null;
  error: string | null;
}

const DOCUMENT_TYPES: { value: DocumentType; label: string; icon: string }[] = [
  { value: 'aadhaar', label: 'Aadhaar Card', icon: '🎫' },
  { value: 'pan', label: 'PAN Card', icon: '💳' },
  { value: 'license', label: 'Driving License', icon: '🚗' },
  { value: 'passport', label: 'Passport', icon: '📕' },
  { value: 'visa', label: 'Visa', icon: '🌍' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface DocumentCaptureInterfaceProps {
  onSubmit?: (data: {
    documentType: DocumentType;
    documentImage: File | null;
    selfieImage?: File | null;
  }) => Promise<void>;
  darkMode?: boolean;
}

const DocumentCaptureInterface: React.FC<DocumentCaptureInterfaceProps> = ({
  onSubmit,
  darkMode = false,
}) => {
  // Navigation & Auth Flow States
  const [currentView, setCurrentView] = useState<AppView>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Document Verification States
  const [selectedDocument, setSelectedDocument] = useState<DocumentType>(null);
  const [documentUpload, setDocumentUpload] = useState<UploadState>({
    file: null,
    preview: null,
    error: null,
  });
  const [selfieUpload, setSelfieUpload] = useState<UploadState>({
    file: null,
    preview: null,
    error: null,
  });
  const [cameraActive, setCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSelfiePreview, setShowSelfiePreview] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const needsSelfie = selectedDocument === 'passport' || selectedDocument === 'visa';

  // Camera Handlers
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to access camera';
      setSelfieUpload(prev => ({ ...prev, error: `Camera access denied: ${message}` }));
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);

        canvasRef.current.toBlob(blob => {
          if (blob) {
            const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
            const preview = canvasRef.current?.toDataURL('image/jpeg') || null;
            setSelfieUpload({ file, preview, error: null });
            stopCamera();
          }
        }, 'image/jpeg');
      }
    }
  }, [stopCamera]);

  // File Upload Handlers
  const handleFileUpload = (file: File | null, isDocument: boolean = true) => {
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      const errorMsg = 'Please upload a valid image file (JPEG, PNG, or WebP)';
      if (isDocument) setDocumentUpload(prev => ({ ...prev, error: errorMsg }));
      else setSelfieUpload(prev => ({ ...prev, error: errorMsg }));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      const errorMsg = `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`;
      if (isDocument) setDocumentUpload(prev => ({ ...prev, error: errorMsg }));
      else setSelfieUpload(prev => ({ ...prev, error: errorMsg }));
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const preview = e.target?.result as string;
      if (isDocument) {
        setDocumentUpload({ file, preview, error: null });
      } else {
        setSelfieUpload({ file, preview, error: null });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, isDocument: boolean = true) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileUpload(files[0], isDocument);
  };

  // Auth Form Handlers
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email || !password) {
      setAuthError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters long');
      return;
    }

    setAuthLoading(true);
    // Simulate backend call to register and send code
    setTimeout(() => {
      setAuthLoading(false);
      setCurrentView('verify-code');
    }, 1000);
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-advance focus
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const codeString = verificationCode.join('');
    if (codeString.length < 6) {
      setAuthError('Please enter the complete 6-digit verification code');
      return;
    }

    setAuthLoading(true);
    // Simulate code validation
    setTimeout(() => {
      setAuthLoading(false);
      setCurrentView('dashboard');
    }, 1000);
  };

  // Final Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedDocument) {
      setSubmitError('Please select a document type');
      return;
    }
    if (!documentUpload.file) {
      setSubmitError('Please upload a document image');
      return;
    }
    if (needsSelfie && !selfieUpload.file) {
      setSubmitError('Please capture a selfie for passport/visa verification');
      return;
    }

    try {
      setIsLoading(true);
      if (onSubmit) {
        await onSubmit({
          documentType: selectedDocument,
          documentImage: documentUpload.file,
          selfieImage: selfieUpload.file || undefined,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred during submission';
      setSubmitError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const bgClass = darkMode ? 'bg-slate-950' : 'bg-white';
  const textClass = darkMode ? 'text-slate-100' : 'text-slate-900';
  const borderClass = darkMode ? 'border-slate-700' : 'border-slate-200';
  const cardBgClass = darkMode ? 'bg-slate-900' : 'bg-slate-50';
  const hoverClass = darkMode ? 'hover:bg-slate-800 focus:bg-slate-800' : 'hover:bg-slate-100 focus:bg-slate-100';
  const inputBgClass = darkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900';
  const errorBgClass = darkMode ? 'bg-red-950' : 'bg-red-50';
  const errorBorderClass = darkMode ? 'border-red-700' : 'border-red-200';

  return (
    <div className={`min-h-screen ${bgClass} ${textClass} transition-colors duration-200 flex flex-col justify-between`}>
      <div className="max-w-xl mx-auto px-4 py-12 w-full">
        
        {/* VIEW 1: SIGN UP */}
        {currentView === 'signup' && (
          <div className={`rounded-xl border-2 ${borderClass} p-8 shadow-sm`}>
            <div className="text-center mb-8">
              <div className="inline-flex p-3 bg-blue-100 dark:bg-blue-900 rounded-full mb-3 text-blue-600 dark:text-blue-400">
                <ShieldCheck size={32} />
              </div>
              <h1 className="text-2xl font-bold">Create Your Account</h1>
              <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Get started with secure AI-powered identity verification
              </p>
            </div>

            {authError && (
              <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${errorBgClass} ${errorBorderClass}`}>
                <AlertCircle className="flex-shrink-0 mt-0.5 text-red-500" size={18} />
                <p className="text-sm">{authError}</p>
              </div>
            )}

            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className={`w-full pl-10 pr-4 py-3 rounded-lg border ${borderClass} ${inputBgClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className={`w-full pl-10 pr-4 py-3 rounded-lg border ${borderClass} ${inputBgClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {authLoading ? <Loader className="animate-spin" size={20} /> : <>Continue <ArrowRight size={18} /></>}
              </button>
            </form>
          </div>
        )}

        {/* VIEW 2: VERIFICATION CODE (OTP) */}
        {currentView === 'verify-code' && (
          <div className={`rounded-xl border-2 ${borderClass} p-8 shadow-sm text-center`}>
            <div className="inline-flex p-3 bg-purple-100 dark:bg-purple-900 rounded-full mb-3 text-purple-600 dark:text-purple-400">
              <Mail size={32} />
            </div>
            <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
            <p className={`text-sm mb-6 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              We've sent a 6-digit verification code to <span className="font-semibold text-blue-500">{email}</span>
            </p>

            {authError && (
              <div className={`mb-6 p-4 rounded-lg border flex items-center justify-center gap-2 ${errorBgClass} ${errorBorderClass}`}>
                <AlertCircle className="text-red-500" size={18} />
                <p className="text-sm">{authError}</p>
              </div>
            )}

            <form onSubmit={handleVerifySubmit}>
              <div className="flex justify-center gap-2 mb-6">
                {verificationCode.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => (codeInputRefs.current[idx] = el)}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleCodeChange(idx, e.target.value)}
                    onKeyDown={e => handleCodeKeyDown(idx, e)}
                    className={`w-12 h-12 text-center text-xl font-bold rounded-lg border ${borderClass} ${inputBgClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {authLoading ? <Loader className="animate-spin" size={20} /> : 'Verify Code'}
              </button>
            </form>

            <button
              onClick={() => setCurrentView('signup')}
              className={`mt-4 text-sm ${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'} underline`}
            >
              Back to Sign Up
            </button>
          </div>
        )}

        {/* VIEW 3: DOCUMENT CAPTURE DASHBOARD */}
        {currentView === 'dashboard' && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold mb-1">Document Verification</h1>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Logged in as <span className="font-medium text-blue-500">{email}</span>
                </p>
              </div>
              <button
                onClick={() => setCurrentView('signup')}
                className={`text-xs px-3 py-1.5 rounded-lg border ${borderClass} ${hoverClass}`}
              >
                Log Out
              </button>
            </div>

            {submitError && (
              <div className={`mb-6 p-4 rounded-lg border-2 flex items-start gap-3 ${errorBgClass} ${errorBorderClass}`}>
                <AlertCircle className="flex-shrink-0 mt-0.5 text-red-500" size={20} />
                <div>
                  <p className="font-semibold text-sm">Error</p>
                  <p className={`text-sm mt-1 ${darkMode ? 'text-red-200' : 'text-red-700'}`}>{submitError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Document Selection */}
              <div className={`rounded-lg border-2 ${borderClass} p-6`}>
                <h2 className="text-xl font-semibold mb-4">Select Document Type</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {DOCUMENT_TYPES.map(doc => (
                    <button
                      key={doc.value}
                      type="button"
                      onClick={() => {
                        setSelectedDocument(doc.value);
                        setSubmitError(null);
                      }}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                        selectedDocument === doc.value
                          ? `border-blue-500 ${cardBgClass} ring-2 ring-blue-400`
                          : `border-transparent ${cardBgClass} ${hoverClass}`
                      }`}
                    >
                      <div className="text-3xl mb-2">{doc.icon}</div>
                      <p className="text-sm font-medium">{doc.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Document Upload Dropzone */}
              <div className={`rounded-lg border-2 ${borderClass} p-6`}>
                <h2 className="text-xl font-semibold mb-4">Upload Document Image</h2>
                <div
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, true)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
                    documentUpload.error ? `${errorBgClass} ${errorBorderClass}` : `${cardBgClass} ${borderClass} hover:border-blue-400`
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => handleFileUpload(e.target.files?.[0] || null, true)}
                    className="hidden"
                  />
                  {!documentUpload.preview ? (
                    <>
                      <div className="flex justify-center mb-3">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                          <Upload size={24} className="text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <p className="font-semibold mb-1">Drag and drop your document</p>
                      <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        or click to browse (JPEG, PNG, WebP - Max 10MB)
                      </p>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <CheckCircle size={32} className="mx-auto text-green-500" />
                      <p className="font-semibold text-green-600 dark:text-green-400">Document uploaded</p>
                    </div>
                  )}
                </div>

                {documentUpload.preview && (
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg ${cardBgClass} hover:opacity-80 transition-opacity mb-3`}
                    >
                      {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
                      {showPreview ? 'Hide' : 'Show'} Preview
                    </button>
                    {showPreview && (
                      <div className="bg-black rounded-lg overflow-hidden">
                        <img src={documentUpload.preview} alt="Document preview" className="w-full h-auto max-h-96 object-contain" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={()
