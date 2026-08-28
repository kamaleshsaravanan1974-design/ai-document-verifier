import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Upload,
  Camera,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';

type DocumentType = 'aadhaar' | 'pan' | 'license' | 'passport' | 'visa' | null;

interface DocumentCaptureInterfaceProps {
  onSubmit?: (data: {
    documentType: DocumentType;
    documentImage: File | null;
    selfieImage?: File | null;
  }) => Promise<void>;
  darkMode?: boolean;
}

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

const DocumentCaptureInterface: React.FC<DocumentCaptureInterfaceProps> = ({
  onSubmit,
  darkMode = false,
}) => {
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
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const needsSelfie = selectedDocument === 'passport' || selectedDocument === 'visa';

  // Start camera stream
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
      setSelfieUpload(prev => ({
        ...prev,
        error: `Camera access denied: ${message}`,
      }));
    }
  }, []);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Capture photo from camera
  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);

        canvasRef.current.toBlob(blob => {
          if (blob) {
            const file = new File([blob], `selfie-${Date.now()}.jpg`, {
              type: 'image/jpeg',
            });
            const preview = canvasRef.current?.toDataURL('image/jpeg') || null;
            setSelfieUpload({
              file,
              preview,
              error: null,
            });
            stopCamera();
          }
        }, 'image/jpeg');
      }
    }
  }, [stopCamera]);

  // Handle file upload
  const handleFileUpload = (
    file: File | null,
    isDocument: boolean = true,
  ) => {
    if (!file) return;

    // Validate file type
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      const errorMsg = 'Please upload a valid image file (JPEG, PNG, or WebP)';
      if (isDocument) {
        setDocumentUpload(prev => ({ ...prev, error: errorMsg }));
      } else {
        setSelfieUpload(prev => ({ ...prev, error: errorMsg }));
      }
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const errorMsg = `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`;
      if (isDocument) {
        setDocumentUpload(prev => ({ ...prev, error: errorMsg }));
      } else {
        setSelfieUpload(prev => ({ ...prev, error: errorMsg }));
      }
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = e => {
      const preview = e.target?.result as string;
      if (isDocument) {
        setDocumentUpload({
          file,
          preview,
          error: null,
        });
      } else {
        setSelfieUpload({
          file,
          preview,
          error: null,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, isDocument: boolean = true) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0], isDocument);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validation
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

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const bgClass = darkMode ? 'bg-slate-950' : 'bg-white';
  const textClass = darkMode ? 'text-slate-100' : 'text-slate-900';
  const borderClass = darkMode ? 'border-slate-700' : 'border-slate-200';
  const cardBgClass = darkMode ? 'bg-slate-900' : 'bg-slate-50';
  const hoverClass = darkMode
    ? 'hover:bg-slate-800 focus:bg-slate-800'
    : 'hover:bg-slate-100 focus:bg-slate-100';
  const inputBgClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const errorBgClass = darkMode ? 'bg-red-950' : 'bg-red-50';
  const errorBorderClass = darkMode ? 'border-red-700' : 'border-red-200';
  const successBgClass = darkMode ? 'bg-green-950' : 'bg-green-50';
  const successBorderClass = darkMode ? 'border-green-700' : 'border-green-200';

  return (
    <div className={`min-h-screen ${bgClass} ${textClass} transition-colors duration-200`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Document Verification</h1>
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Upload your document and complete biometric verification for passport/visa
          </p>
        </div>

        {/* Error Alert */}
        {submitError && (
          <div
            className={`mb-6 p-4 rounded-lg border-2 flex items-start gap-3 ${errorBgClass} ${errorBorderClass}`}
          >
            <AlertCircle className="flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-sm">Error</p>
              <p className={`text-sm mt-1 ${darkMode ? 'text-red-200' : 'text-red-700'}`}>
                {submitError}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Document Type Selection */}
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

          {/* Document Upload */}
          <div className={`rounded-lg border-2 ${borderClass} p-6`}>
            <h2 className="text-xl font-semibold mb-4">Upload Document Image</h2>

            {/* Upload Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, true)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
                documentUpload.error
                  ? `${errorBgClass} ${errorBorderClass}`
                  : `${cardBgClass} ${borderClass} hover:border-blue-400`
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

            {/* Error State */}
            {documentUpload.error && (
              <div className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${errorBgClass}`}>
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <p className="text-sm">{documentUpload.error}</p>
              </div>
            )}

            {/* Preview */}
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
                    <img
                      src={documentUpload.preview}
                      alt="Document preview"
                      className="w-full h-auto max-h-96 object-contain"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setDocumentUpload({ file: null, preview: null, error: null });
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className={`mt-3 text-sm text-red-500 hover:text-red-700 font-medium`}
                >
                  Remove and upload different image
                </button>
              </div>
            )}
          </div>

          {/* Conditional Selfie Section for Passport/Visa */}
          {needsSelfie && (
            <div className={`rounded-lg border-2 border-purple-400 bg-purple-50 dark:bg-purple-950 p-6`}>
              <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                <Camera size={20} />
                Selfie Capture Required
              </h2>
              <p className={`text-sm mb-6 ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                Your selected document ({selectedDocument?.toUpperCase()}) requires a selfie for
                biometric verification
              </p>

              {!cameraActive && !selfieUpload.preview && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <Camera size={20} />
                  Start Camera
                </button>
              )}

              {/* Camera Stream */}
              {cameraActive && (
                <div className="space-y-4">
                  <div className={`rounded-lg overflow-hidden bg-black relative`}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full aspect-video object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Camera overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-64 h-80 border-4 border-green-400 rounded-lg opacity-50" />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                      <Camera size={20} />
                      Capture Photo
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className={`flex-1 border-2 font-semibold py-3 rounded-lg transition-colors duration-200 ${borderClass} ${hoverClass}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Error State */}
              {selfieUpload.error && (
                <div className={`p-3 rounded-lg flex items-start gap-2 ${errorBgClass} ${errorBorderClass}`}>
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{selfieUpload.error}</p>
                </div>
              )}

              {/* Preview */}
              {selfieUpload.preview && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                    <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                    <p className="text-sm font-medium">Selfie captured successfully</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSelfiePreview(!showSelfiePreview)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg ${cardBgClass} hover:opacity-80 transition-opacity`}
                  >
                    {showSelfiePreview ? <EyeOff size={18} /> : <Eye size={18} />}
                    {showSelfiePreview ? 'Hide' : 'Show'} Preview
                  </button>

                  {showSelfiePreview && (
                    <div className="bg-black rounded-lg overflow-hidden">
                      <img
                        src={selfieUpload.preview}
                        alt="Selfie preview"
                        className="w-full h-auto max-h-96 object-contain"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelfieUpload({ file: null, preview: null, error: null });
                      setShowSelfiePreview(false);
                    }}
                    className="text-sm text-red-500 hover:text-red-700 font-medium"
                  >
                    Retake Photo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !selectedDocument || !documentUpload.file}
            className={`w-full py-3 rounded-lg font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 ${
              isLoading || !selectedDocument || !documentUpload.file
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
          >
            {isLoading ? (
              <>
                <Loader size={20} className="animate-spin" />
                Analyzing Document...
              </>
            ) : (
              <>
                <FileText size={20} />
                Verify Document
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DocumentCaptureInterface;
