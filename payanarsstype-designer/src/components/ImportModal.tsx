import React, { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (files: File[]) => Promise<void>;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in MB
  multiple?: boolean;
  title?: string;
  description?: string;
}

const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  acceptedFileTypes = [".csv", ".xlsx", ".xls", ".json", ".xml", ".pdf"],
  maxFileSize = 10, // 10MB default
  multiple = true,
  title = "Import Files",
  description = "Upload your files to import data into the system.",
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!acceptedFileTypes.includes(fileExtension)) {
      return `"${file.name}" is not a supported file type. Accepted: ${acceptedFileTypes.join(", ")}`;
    }
    if (file.size > maxFileSize * 1024 * 1024) {
      return `"${file.name}" exceeds the maximum file size of ${maxFileSize}MB.`;
    }
    return null;
  };

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const validFiles: File[] = [];
      const newErrors: string[] = [];

      fileArray.forEach((file) => {
        const error = validateFile(file);
        if (error) {
          newErrors.push(error);
        } else {
          // Avoid duplicates
          const isDuplicate = files.some(
            (f) => f.name === file.name && f.size === file.size
          );
          if (!isDuplicate) {
            validFiles.push(file);
          } else {
            newErrors.push(`"${file.name}" is already added.`);
          }
        }
      });

      if (newErrors.length > 0) {
        setErrors((prev) => [...prev, ...newErrors]);
      }

      if (validFiles.length > 0) {
        if (multiple) {
          setFiles((prev) => [...prev, ...validFiles]);
        } else {
          setFiles([validFiles[0]]);
        }
      }
    },
    [files, multiple, acceptedFileTypes, maxFileSize]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const handleImport = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setErrors([]);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await onImport(files);

      clearInterval(progressInterval);
      setUploadProgress(100);

      toast({
        title: "Import Successful",
        description: `${files.length} file(s) imported successfully.`,
      });

      // Reset and close after success
      setTimeout(() => {
        handleReset();
        onClose();
      }, 500);
    } catch (error: any) {
      setErrors([error?.message || "Import failed. Please try again."]);
      toast({
        title: "Import Failed",
        description: error?.message || "An error occurred during import.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setErrors([]);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleClose = () => {
    if (!isUploading) {
      handleReset();
      onClose();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (fileName: string): string => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "csv":
        return "📊";
      case "xlsx":
      case "xls":
        return "📗";
      case "json":
        return "📋";
      case "xml":
        return "📄";
      case "pdf":
        return "📕";
      default:
        return "📁";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Drop Zone */}
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${isDragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
              : "border-gray-300 hover:border-gray-400 dark:border-gray-600"
            }
            ${isUploading ? "pointer-events-none opacity-50" : ""}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={acceptedFileTypes.join(",")}
            multiple={multiple}
            onChange={handleFileInputChange}
          />
          <div className="text-4xl mb-2">📤</div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isDragging ? "Drop files here..." : "Drag & drop files here, or click to browse"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Supported: {acceptedFileTypes.join(", ")} (Max: {maxFileSize}MB)
          </p>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="max-h-40 overflow-y-auto space-y-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span>{getFileIcon(file.name)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                {!isUploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-xs text-center text-gray-500">
              Importing... {uploadProgress}%
            </p>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-3">
            <div className="flex justify-between items-start">
              <div>
                {errors.map((error, index) => (
                  <p key={index} className="text-xs text-red-600 dark:text-red-400">
                    {error}
                  </p>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearErrors}
                className="text-red-500 shrink-0 h-5 w-5 p-0"
              >
                ✕
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={files.length === 0 || isUploading}
          >
            {isUploading ? "Importing..." : `Import ${files.length > 0 ? `(${files.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportModal;
