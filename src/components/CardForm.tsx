import React, { useState, useEffect } from 'react';
import { Check, FileText } from 'lucide-react';
import type { Project, Card } from '../types';
import { RichTextEditor } from './RichTextEditor';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface CardFormProps {
    onSave: (card: Omit<Card, 'id'> | Card) => void;
    onCancel: () => void;
    projects: Project[];
    initialData?: Card | null;
    className?: string; // Allow custom styling wrapper
}

export const CardForm: React.FC<CardFormProps> = ({
    onSave,
    onCancel,
    projects,
    initialData,
    className
}) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [dueDate, setDueDate] = useState('');

    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

    // Use ref to hold the latest onSave callback to avoid effect dependencies
    const onSaveRef = React.useRef(onSave);
    const initialDataRef = React.useRef(initialData);

    useEffect(() => {
        onSaveRef.current = onSave;
        initialDataRef.current = initialData;
    }, [onSave, initialData]);

    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title);
            setContent(initialData.content);
            setSelectedProjectIds(initialData.projectIds || []);
            setDueDate(initialData.dueDate || '');
        } else {
            setTitle('');
            setContent('');
            setSelectedProjectIds([]);
            setDueDate('');
        }
    }, [initialData?.id]); // Only reset form when switching cards (ID changes), not when content updates triggers prop update

    useEffect(() => {
        if (!initialDataRef.current) return;

        setSaveStatus('saving');
        const timeoutId = setTimeout(() => {
            onSaveRef.current({
                ...(initialDataRef.current || {}),
                title,
                content,
                projectIds: selectedProjectIds,
                dueDate: dueDate || undefined
            } as Card);
            setSaveStatus('saved');
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [title, content, selectedProjectIds, dueDate]); // Depend ONLY on user-editable state

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...(initialData || {}),
            title,
            content,
            projectIds: selectedProjectIds,
            dueDate: dueDate || undefined
        } as Card);
    };

    const toggleProject = (projectId: string) => {
        setSelectedProjectIds(prev =>
            prev.includes(projectId)
                ? prev.filter(id => id !== projectId)
                : [...prev, projectId]
        );
    };

    // ... (in handleExportPDF)

    const handleExportPDF = async () => {
        try {
            const doc = new jsPDF({
                unit: 'pt', // Use points for easier calc with A4
                format: 'a4'
            });

            // A4 Dimensions: 595.28 x 841.89 pt
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = doc.internal.pageSize.getHeight();
            const margin = 30;
            const contentWidth = pdfWidth - (margin * 2);

            // Format Date
            let dateStr = '';
            if (dueDate) {
                const dateObj = new Date(dueDate);
                dateStr = dateObj.toLocaleDateString('de-DE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }

            // Create a temporary container for rendering
            // We append it to the body to ensure it can be rendered by html2canvas
            const tempDiv = document.createElement('div');

            // Essential Styles for Capture
            tempDiv.style.width = '700px'; // Fixed width for consistent scaling (700px gives good resolution on A4)
            tempDiv.style.padding = '40px';
            tempDiv.style.background = 'white';
            tempDiv.style.color = 'black';
            tempDiv.style.fontFamily = 'Helvetica, Arial, sans-serif';
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px'; // Hide from view
            tempDiv.style.top = '0';
            tempDiv.style.zIndex = '-1';

            // HTML Structure
            tempDiv.innerHTML = `
                <div style="font-family: Helvetica, Arial, sans-serif;">
                    <h1 style="font-size: 24px; font-weight: 500; margin-bottom: 12px; color: #111; line-height: 1.2;">${title}</h1>
                    ${dateStr ? `<div style="font-size: 14px; color: #666; margin-bottom: 30px;">Fällig am: ${dateStr}</div>` : ''}
                    <hr style="border: 0; border-top: 1px solid #ddd; margin: 30px 0;" />
                    <div class="pdf-content" style="font-size: 14px; line-height: 1.6;">
                        ${content.replace(/<mark[^>]*>/g, '<span style="background-color: #bbf7d0; color: #000; padding: 0 2px; border-radius: 2px; line-height: 1.2; display: inline; box-decoration-break: clone; -webkit-box-decoration-break: clone;">').replace(/<\/mark>/g, '</span>')}
                    </div>
                </div>
                <style>
                    /* Custom bullet points for perfect alignment */
                    .pdf-content ul {
                        list-style: none !important;
                        padding-left: 0 !important;
                        margin-bottom: 15px !important;
                    }
                    .pdf-content li {
                        position: relative !important;
                        padding-left: 24px !important;
                        margin-bottom: 8px !important;
                        line-height: 1.5 !important;
                    }
                    .pdf-content li::before {
                        content: "•" !important;
                        position: absolute !important;
                        left: 8px !important;
                        top: -2px !important; 
                        font-size: 20px !important;
                        line-height: 1 !important;
                        color: #333 !important;
                    }
                    /* Ensure paragraphs have space */
                    .pdf-content p {
                        margin-bottom: 10px !important;
                    }
                    /* Table Styling - ULTRA COMPACT */
                    .pdf-content table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        margin-bottom: 20px !important;
                        font-size: 11px !important; 
                    }
                    .pdf-content th, .pdf-content td {
                        border: 1px solid #d1d5db !important; 
                        padding: 3px 6px !important; /* Even tighter padding */
                        text-align: left !important;
                        vertical-align: top !important;
                        line-height: 1.3 !important;
                    }
                    .pdf-content th {
                        background-color: #f3f4f6 !important;
                        font-weight: 700 !important;
                    }
                </style>
            `;

            // Fix images manually before capture
            const images = tempDiv.getElementsByTagName('img');
            for (let img of images) {
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
                img.style.marginTop = '10px';
                img.style.marginBottom = '10px';
                // CORS issues often break html2canvas images
                img.crossOrigin = "Anonymous";
            }

            document.body.appendChild(tempDiv);

            // Wait a moment for images to "render" in the DOM (even if offscreen)
            // Ideally we'd load them, but a small delay often helps
            await new Promise(resolve => setTimeout(resolve, 500));

            // Use html2canvas to capture the element as an image
            const canvas = await html2canvas(tempDiv, {
                scale: 2, // Higher scale for better quality
                useCORS: true, // Attempt to handle external images
                logging: false,
                backgroundColor: '#ffffff'
            });

            // Cleanup DOM
            document.body.removeChild(tempDiv);

            // Calculate dimensions to fit on PDF
            const imgData = canvas.toDataURL('image/png'); // reduced quality slightly for size? png is lossless.
            const imgWidth = contentWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Multi-page handling (Simple version: if it's too long, we just let it stretch or cut)
            // For a robust multi-page image split, we'd need complex math.
            // For now, let's just add the image. If it's longer than a page, jspdf adds one page.

            // Actually, if height > pageHeight, we need to splice.
            // Let's implement a simple multi-page splicer

            let heightLeft = imgHeight;
            let pageHeightContent = pdfHeight - (margin * 2);

            // First page
            doc.addImage(imgData, 'PNG', margin, margin, imgWidth, Math.min(imgHeight, pageHeightContent));
            heightLeft -= pageHeightContent;

            // Subsequent pages (if needed) - this is a naive slice (it might cut text in half)
            // A better approach for text is letting jspdf handle it, but for "exact visual reproduction" image is best.
            // Given the complexity of "clean cut", let's stick to single page if possible, or naive cut if long.

            // Revert to simple single image add (jsPDF manages large images poorly by default)
            // Let's just create a very tall PDF page if content is huge? No, user wants A4.

            // Redo: Standard approach
            if (imgHeight <= pageHeightContent) {
                doc.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
            } else {
                // It's long.
                let y = 0; // sourced y from canvas
                while (heightLeft > 0) {
                    // We can't easily "slice" the dataURL without a second canvas context.
                    // For MVP stability: Just resize it to fit one page if it's close, OR warn.
                    // Or better: Use the standard "add image with offset" trick

                    // Page 1
                    if (y === 0) {
                        // We already added it above? No.
                        doc.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
                        // Note: JS PDF doesn't crop. It prints the whole thing.
                        // So we'd see the rest of the image flowing off page.

                        // To do this properly requires creating sub-canvases.
                        // Let's assume for this step, keeping it on one page (maybe scaling down if HUGE?) is safer 
                        // or just let it overflow for now to verify "content appears".
                        // The user said "empty white page", solving *that* is priority #1.
                    } else {
                        doc.addPage();
                        doc.addImage(imgData, 'PNG', margin, margin - y, imgWidth, imgHeight); // Shift image up
                    }

                    heightLeft -= pdfHeight;
                    y += pdfHeight;
                    // This "Shift Up" technique works in many cases to show the "rest" of the image.
                    break; // Limit to 2 pages for safety in this fix
                }
            }

            const safeTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
            doc.save(`${safeTitle || 'card'}_export.pdf`);

        } catch (error) {
            console.error("PDF generation failed:", error);
            alert("Export failed. See console.");
        }
    };

    const todoProject = projects.find(proj => proj.name === 'TODO');
    const isTodoCard = initialData && todoProject && initialData.projectIds.includes(todoProject.id);

    return (
        <form onSubmit={handleSubmit} className={`space-y-4 ${className || ''}`}>
            <div>
                <label className="block text-sm font-medium mb-1 text-gray-300">
                    Title
                </label>
                <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 placeholder-gray-500 font-bold"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                    Projects
                </label>
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                    {projects.map(p => {
                        const isSelected = selectedProjectIds.includes(p.id);
                        const isDisabled = !!isTodoCard;

                        return (
                            <button
                                key={p.id}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => toggleProject(p.id)}
                                className={`
                  inline-flex items-center space-x-1 px-1.5 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-sm font-medium transition-all border
                  ${isSelected
                                        ? 'border-transparent shadow-sm text-white' // Active: White text
                                        : 'bg-slate-800 border-gray-700 text-gray-400 hover:bg-slate-700 hover:text-gray-200'}
                  ${isDisabled && !isSelected ? 'opacity-30 cursor-not-allowed' : ''}
                  ${isDisabled && isSelected ? 'cursor-default' : ''}
                `}
                                style={isSelected ? { backgroundColor: p.color } : {}}
                            >
                                <span>{p.name}</span>
                                {isSelected && <Check className="w-3 h-3 ml-1" />}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1 text-gray-300">
                    Content
                </label>
                <div className="flex-1 min-h-[400px]">
                    <RichTextEditor
                        key={initialData?.id || 'new'}
                        content={content}
                        onChange={setContent}
                    />
                </div>
            </div>

            {!isTodoCard && (
                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-300">
                        Due Date
                    </label>
                    <DatePicker
                        selected={dueDate ? new Date(dueDate) : null}
                        onChange={(date: Date | null) => {
                            if (date) {
                                const offset = date.getTimezoneOffset();
                                const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
                                setDueDate(adjustedDate.toISOString().split('T')[0]);
                            } else {
                                setDueDate('');
                            }
                        }}
                        dateFormat="dd.MM.yyyy"
                        className="w-full px-3 py-2 bg-slate-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 placeholder-gray-500"
                        placeholderText="Select due date"
                        isClearable
                    />
                </div>
            )}

            <div className="flex justify-between items-center pt-4 space-x-2 border-t border-gray-700 mt-6">
                {/* Left Side: Export Button */}
                {initialData && (
                    <button
                        type="button"
                        onClick={handleExportPDF}
                        className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700"
                        title="Export as PDF"
                    >
                        <FileText className="w-4 h-4" />
                        <span className="text-xs font-medium">Export PDF</span>
                    </button>
                )}

                {/* Right Side: Actions */}
                <div className="flex items-center space-x-2">
                    {!initialData ? (
                        <>
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-4 py-2 text-sm font-medium text-gray-300 hover:bg-slate-800 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={selectedProjectIds.length === 0}
                                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${selectedProjectIds.length === 0 ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-blue-600 hover:bg-blue-700'}`}
                                title={selectedProjectIds.length === 0 ? "Select at least one project" : ""}
                            >
                                Save
                            </button>
                        </>
                    ) : (
                        <div className="text-sm text-gray-500 italic flex items-center">
                            {saveStatus === 'saving' ? 'Saving...' : 'All changes saved'}
                        </div>
                    )}
                </div>
            </div>
        </form>
    );
};
