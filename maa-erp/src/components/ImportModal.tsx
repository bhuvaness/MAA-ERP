import React, { useRef, useState, useCallback, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
}

const ImportModal: React.FC<Props> = ({ isOpen, onClose, onFileSelected }) => {
  const [isDragover, setIsDragover] = useState(false);
  const excelRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragover(false);
    if (e.dataTransfer.files[0]) { onFileSelected(e.dataTransfer.files[0]); onClose(); }
  }, [onFileSelected, onClose]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) { onFileSelected(e.target.files[0]); onClose(); }
    e.target.value = '';
  }, [onFileSelected, onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="import-overlay open" onClick={handleOverlayClick}>
      <div className="import-modal">
        <div className="import-modal-header">
          <h3>Import Data</h3>
          <button className="import-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="import-modal-body">
          <div className={`import-dropzone${isDragover ? ' dragover' : ''}`}
            onClick={() => excelRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragover(true); }}
            onDragLeave={() => setIsDragover(false)}
            onDrop={handleDrop}>
            <div className="import-dropzone-icon">📃</div>
            <h4>Drop your file here, or <span className="import-dropzone-browse">browse</span></h4>
            <p>Viki maps columns automatically</p>
          </div>
          <div className="import-types">
            <button className="import-type-tag" onClick={() => excelRef.current?.click()}><span>📗</span> Excel</button>
            <button className="import-type-tag" onClick={() => excelRef.current?.click()}><span>📄</span> CSV</button>
            <button className="import-type-tag" onClick={() => jsonRef.current?.click()}><span>📃</span> JSON</button>
          </div>
        </div>
      </div>
      <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv,.tsv" style={{ display: 'none' }} onChange={handleFileChange} />
      <input ref={jsonRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
};

export default ImportModal;
