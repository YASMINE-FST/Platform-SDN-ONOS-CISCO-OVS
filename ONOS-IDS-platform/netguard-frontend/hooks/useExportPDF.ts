import { useCallback } from 'react';

export interface ExportPDFOptions {
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  backgroundColor?: string;
  scale?: number;
}

/**
 * Captures a DOM element to a paginated A4 PDF.
 * jspdf + html2canvas are loaded dynamically so they only ship when used.
 */
export function useExportPDF() {
  const exportToPDF = useCallback(
    async (elementId: string, options: ExportPDFOptions = {}) => {
      const {
        filename = 'export.pdf',
        orientation = 'portrait',
        backgroundColor = '#ffffff',
        scale = 2,
      } = options;

      const element = document.getElementById(elementId);
      if (!element) throw new Error(`Element "${elementId}" not found`);

      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const canvas = await html2canvas(element, {
        scale,
        backgroundColor,
        windowHeight: element.scrollHeight,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

      const pageWidth  = orientation === 'portrait' ? 210 : 297;
      const pageHeight = orientation === 'portrait' ? 297 : 210;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let remaining = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
      remaining -= pageHeight;

      while (remaining > 0) {
        position = remaining - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
        remaining -= pageHeight;
      }

      pdf.save(filename);
    },
    [],
  );

  return { exportToPDF };
}
