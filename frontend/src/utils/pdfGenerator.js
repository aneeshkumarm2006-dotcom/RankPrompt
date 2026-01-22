import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generate a high-quality PDF from report data
 * Much better than html2pdf.js - creates professional, readable PDFs
 */
export const generateReportPDF = async (brandName, reportData, stats, platformChartData, categoryChartData) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Helper function to add new page if needed
  const checkPageBreak = (requiredSpace = 20) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Title
  pdf.setFontSize(24);
  pdf.setTextColor(139, 92, 246); // Primary color
  pdf.text(`${brandName}`, margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(16);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Visibility Analysis Report', margin, yPosition);
  yPosition += 15;

  // Stats Cards
  pdf.setFontSize(12);
  pdf.setTextColor(0, 0, 0);
  const cardWidth = (contentWidth - 10) / 4;
  const statsData = [
    { label: 'Total Prompts', value: stats.totalPrompts || 0, color: [139, 92, 246] },
    { label: 'Website Found', value: stats.websiteFound || 0, color: [16, 185, 129] },
    { label: 'Brand Mentioned', value: stats.brandMentioned || 0, color: [59, 130, 246] },
    { label: 'Total Findings', value: stats.totalFindings || 0, color: [168, 85, 247] }
  ];

  statsData.forEach((stat, index) => {
    const x = margin + index * (cardWidth + 3);
    
    // Card background
    pdf.setFillColor(245, 245, 245);
    pdf.roundedRect(x, yPosition, cardWidth, 20, 2, 2, 'F');
    
    // Label
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(stat.label, x + 3, yPosition + 6);
    
    // Value
    pdf.setFontSize(16);
    pdf.setTextColor(...stat.color);
    pdf.text(String(stat.value), x + 3, yPosition + 15);
  });
  
  yPosition += 30;

  // Platform Visibility
  checkPageBreak(80);
  pdf.setFontSize(14);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Visibility Score by Platform', margin, yPosition);
  yPosition += 10;

  if (platformChartData && platformChartData.length > 0) {
    platformChartData.forEach((platform, index) => {
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text(platform.name, margin + 5, yPosition);
      
      // Progress bar
      const barWidth = contentWidth - 60;
      const barHeight = 6;
      const fillWidth = (platform.visibility / 100) * barWidth;
      
      // Background
      pdf.setFillColor(220, 220, 220);
      pdf.rect(margin + 50, yPosition - 4, barWidth, barHeight, 'F');
      
      // Fill
      pdf.setFillColor(139, 92, 246);
      pdf.rect(margin + 50, yPosition - 4, fillWidth, barHeight, 'F');
      
      // Percentage
      pdf.setTextColor(139, 92, 246);
      pdf.text(`${platform.visibility}%`, margin + 50 + barWidth + 3, yPosition);
      
      yPosition += 12;
      checkPageBreak(15);
    });
    
    yPosition += 5;
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    const avgScore = Math.round(platformChartData.reduce((acc, p) => acc + p.score, 0) / platformChartData.length);
    pdf.text(`Overall Visibility Score: ${avgScore}%`, margin, yPosition);
    yPosition += 15;
  }

  // Top Categories
  checkPageBreak(60);
  pdf.setFontSize(14);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Top Performing Categories', margin, yPosition);
  yPosition += 10;

  if (categoryChartData && categoryChartData.length > 0) {
    categoryChartData.slice(0, 5).forEach((category, index) => {
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      const categoryName = category.name.length > 25 ? category.name.substring(0, 22) + '...' : category.name;
      pdf.text(`${index + 1}. ${categoryName}`, margin + 5, yPosition);
      
      // Progress bar
      const barWidth = contentWidth - 60;
      const barHeight = 6;
      const fillWidth = (category.visibility / 100) * barWidth;
      
      // Background
      pdf.setFillColor(220, 220, 220);
      pdf.rect(margin + 50, yPosition - 4, barWidth, barHeight, 'F');
      
      // Fill
      pdf.setFillColor(16, 185, 129);
      pdf.rect(margin + 50, yPosition - 4, fillWidth, barHeight, 'F');
      
      // Percentage
      pdf.setTextColor(16, 185, 129);
      pdf.text(`${category.visibility}%`, margin + 50 + barWidth + 3, yPosition);
      
      yPosition += 12;
      checkPageBreak(15);
    });
  }

  yPosition += 10;

  // Results Summary Table
  checkPageBreak(40);
  pdf.setFontSize(14);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Detailed Results', margin, yPosition);
  yPosition += 10;

  // Table header
  pdf.setFillColor(245, 245, 245);
  pdf.rect(margin, yPosition - 5, contentWidth, 8, 'F');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Prompt', margin + 2, yPosition);
  pdf.text('Category', margin + 60, yPosition);
  pdf.text('Platform', margin + 90, yPosition);
  pdf.text('Found', margin + 120, yPosition);
  pdf.text('Index', margin + 140, yPosition);
  yPosition += 8;

  // Table rows
  let rowCount = 0;
  const maxRows = 30; // Limit for readability

  for (const item of reportData.slice(0, maxRows)) {
    if (item.response && Array.isArray(item.response)) {
      for (let pIdx = 0; pIdx < item.response.length; pIdx++) {
        const platformData = item.response[pIdx];
        
        checkPageBreak(10);
        
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);
        
        // Only show prompt and category for first row of each item
        if (pIdx === 0) {
          const promptText = item.prompt.length > 30 ? item.prompt.substring(0, 27) + '...' : item.prompt;
          pdf.text(promptText, margin + 2, yPosition);
          
          const categoryText = item.category && item.category.length > 15 ? item.category.substring(0, 12) + '...' : (item.category || '-');
          pdf.text(categoryText, margin + 60, yPosition);
        }
        
        // Platform
        const platformName = platformData.src === 'google_ai_overviews' ? 'Google AI' : platformData.src;
        pdf.text(platformName, margin + 90, yPosition);
        
        // Found
        if (platformData.found) {
          pdf.setTextColor(16, 185, 129);
          pdf.text('Yes', margin + 120, yPosition);
        } else {
          pdf.setTextColor(239, 68, 68);
          pdf.text('No', margin + 120, yPosition);
        }
        
        // Index
        pdf.setTextColor(0, 0, 0);
        pdf.text(platformData.index !== null ? `#${platformData.index}` : '-', margin + 140, yPosition);
        
        yPosition += 7;
        rowCount++;
        
        if (rowCount >= maxRows) break;
      }
    }
    
    if (rowCount >= maxRows) break;
  }

  if (reportData.length > maxRows) {
    yPosition += 5;
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Showing ${maxRows} of ${reportData.length} total prompts. Download full report for complete details.`, margin, yPosition);
  }

  // Footer with branding
  const footerY = pageHeight - 10;
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text('Generated by RankPrompt - AI Visibility Analysis Platform', pageWidth / 2, footerY, { align: 'center' });

  // Save PDF
  pdf.save(`${brandName.replace(/[^a-z0-9]/gi, '_')}_Visibility_Analysis.pdf`);
};

/**
 * Alternative: Capture the entire report as image and convert to PDF
 * Use this if you prefer visual accuracy over file size
 */
export const generateReportPDFFromHTML = async (elementId, brandName) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found:', elementId);
    return;
  }

  try {
    // Temporarily modify element for better PDF capture
    const originalStyle = {
      background: element.style.background,
      width: element.style.width
    };
    
    element.style.background = '#1f2937';
    element.style.width = '1200px';

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#1f2937',
      logging: false
    });

    // Restore original styles
    element.style.background = originalStyle.background;
    element.style.width = originalStyle.width;

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 10;

    // Add first page
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - 20);

    // Add additional pages if needed
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 20);
    }

    pdf.save(`${brandName.replace(/[^a-z0-9]/gi, '_')}_Visibility_Analysis.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again.');
  }
};
