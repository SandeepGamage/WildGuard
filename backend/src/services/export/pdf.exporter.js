const PDFDocument = require('pdfkit');
const { EXPORT_SECTIONS } = require('../../constants/domain');
const { typeLabel, monthLabel, kpiRows, reportFileName, REPORT_TYPE_LABELS } = require('./reportText');

/** Viridis ramp, one colour per heatmap legend level (colour-blind safe; Crameri et al., 2020). */
const VIRIDIS = Object.freeze(['#3b528b', '#2c728e', '#21918c', '#5ec962', '#fde725']);
const INK = '#1f2a24';
const MUTED = '#5b6660';
const BRAND = '#1f6b3a';
const PAGE_MARGIN = 48;

/** PdfExporter (ReportExporter strategy): printable report for ministries and donors. */
class PdfExporter {
  /**
   * @param {object} report ConservationReport.
   * @param {string[]} sections Values from EXPORT_SECTIONS.
   * @returns {Promise<{ filename: string, contentType: string, content: Buffer }>}
   */
  export(report, sections) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: PAGE_MARGIN,
        info: { Title: 'WildGuard LK report' },
      });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () =>
        resolve({
          filename: reportFileName(report, 'pdf'),
          contentType: 'application/pdf',
          content: Buffer.concat(chunks),
        }),
      );

      this.#header(doc, report);
      if (sections.includes(EXPORT_SECTIONS.KPI_SUMMARY)) this.#kpis(doc, report);
      if (sections.includes(EXPORT_SECTIONS.HOTSPOT_MAP)) this.#hotspots(doc, report);
      if (sections.includes(EXPORT_SECTIONS.COVERAGE_GAPS)) this.#coverage(doc, report);
      if (sections.includes(EXPORT_SECTIONS.CONFLICT_TRENDS)) this.#trends(doc, report);
      if (sections.includes(EXPORT_SECTIONS.INCIDENT_LIST)) this.#incidentList(doc, report);
      doc
        .moveDown(1.5)
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          'Community reports are included only after verification. Reporter phone numbers are never exported.',
        );
      doc.end();
    });
  }

  #header(doc, report) {
    doc.fontSize(18).fillColor(BRAND).text('WildGuard LK - Conservation report');
    doc
      .moveDown(0.3)
      .fontSize(10)
      .fillColor(INK)
      .text(`${report.park?.name ?? report.parkId}  |  ${report.filter.dateFrom} to ${report.filter.dateTo}`)
      .text(`Report type: ${REPORT_TYPE_LABELS[report.filter.reportType] ?? report.filter.reportType}`)
      .fillColor(MUTED)
      .text(`Generated ${new Date(report.generatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  }

  #heading(doc, text) {
    if (doc.y > doc.page.height - 160) doc.addPage();
    doc.moveDown(1).fontSize(13).fillColor(BRAND).text(text, PAGE_MARGIN).moveDown(0.3);
  }

  /** Simple left-aligned table; widths are fractions of the printable width. */
  #table(doc, header, rows, widths) {
    const total = doc.page.width - PAGE_MARGIN * 2;
    const row = (cells, bold) => {
      if (doc.y > doc.page.height - PAGE_MARGIN - 20) doc.addPage();
      const y = doc.y;
      let x = PAGE_MARGIN;
      let height = 0;
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .fillColor(bold ? INK : '#333333');
      cells.forEach((cell, index) => {
        const width = total * widths[index];
        doc.text(String(cell ?? ''), x, y, { width: width - 6 });
        height = Math.max(height, doc.y - y);
        x += width;
      });
      doc.y = y + height + 4;
    };
    row(header, true);
    rows.forEach((cells) => row(cells, false));
    doc.font('Helvetica');
  }

  #kpis(doc, report) {
    this.#heading(doc, 'Summary');
    this.#table(doc, ['Metric', 'Value', 'Note'], kpiRows(report), [0.35, 0.2, 0.45]);
    this.#heading(doc, 'Incidents by type');
    this.#table(
      doc,
      ['Type', 'Count'],
      report.stats.byType.map((r) => [typeLabel(r.type), r.count]),
      [0.7, 0.3],
    );
  }

  #hotspots(doc, report) {
    const heatmap = report.heatmap;
    this.#heading(doc, `Hotspots (kernel density, ${heatmap?.bandwidthMetres ?? '-'} m bandwidth)`);
    if (heatmap?.cells?.length && heatmap.bounds && heatmap.cellSizeDeg) {
      this.#drawHeatmap(doc, report);
    }
    this.#table(
      doc,
      ['Area', 'Incidents', 'Main type'],
      report.topHotspots.map((r) => [r.area, r.incidents, typeLabel(r.mainType)]),
      [0.4, 0.2, 0.4],
    );
  }

  #drawHeatmap(doc, report) {
    const { bounds, cellSizeDeg, cells, classBreaks } = report.heatmap;
    const mapWidth = 300;
    const latSpan = bounds.maxLat - bounds.minLat;
    const lngSpan = bounds.maxLng - bounds.minLng;
    const mapHeight = Math.min(300, mapWidth * (latSpan / lngSpan));
    if (doc.y + mapHeight + 40 > doc.page.height - PAGE_MARGIN) doc.addPage();
    const left = PAGE_MARGIN;
    const top = doc.y;
    const x = (lng) => left + ((lng - bounds.minLng) / lngSpan) * mapWidth;
    const y = (lat) => top + ((bounds.maxLat - lat) / latSpan) * mapHeight;

    doc.save().rect(left, top, mapWidth, mapHeight).fill('#eef3ee').restore();
    const cellW = (cellSizeDeg.longitude / lngSpan) * mapWidth;
    const cellH = (cellSizeDeg.latitude / latSpan) * mapHeight;
    for (const cell of cells) {
      doc
        .rect(x(cell.longitude) - cellW / 2, y(cell.latitude) - cellH / 2, cellW + 0.3, cellH + 0.3)
        .fill(VIRIDIS[cell.level] ?? VIRIDIS[0]);
    }
    const outline = report.park?.boundary ?? [];
    if (outline.length) {
      doc.moveTo(x(outline[0].longitude), y(outline[0].latitude));
      outline.slice(1).forEach((p) => doc.lineTo(x(p.longitude), y(p.latitude)));
      doc.closePath().lineWidth(1).stroke(BRAND);
    }
    for (const place of report.landmarks ?? []) {
      const labelX = x(place.longitude) + 4;
      const labelY = y(place.latitude) - 4;
      doc.fontSize(7);
      // A white plate keeps the label readable over dark heat cells.
      doc
        .rect(labelX - 1, labelY - 1, doc.widthOfString(place.name) + 2, 9)
        .fillOpacity(0.8)
        .fill('#ffffff')
        .fillOpacity(1);
      doc.circle(x(place.longitude), y(place.latitude), 2.5).fill(INK);
      doc.fillColor(INK).text(place.name, labelX, labelY, { lineBreak: false });
    }

    let legendX = left;
    const legendY = top + mapHeight + 8;
    doc.fontSize(8).fillColor(INK).text('Incidents per km2:', legendX, legendY);
    legendX += 80;
    classBreaks.forEach((value, index) => {
      doc.rect(legendX, legendY, 10, 8).fill(VIRIDIS[index]);
      doc
        .fillColor(INK)
        .text(`${value}${index === classBreaks.length - 1 ? '+' : ''}`, legendX + 13, legendY);
      legendX += 45;
    });
    doc.x = PAGE_MARGIN;
    doc.y = legendY + 18;
  }

  #coverage(doc, report) {
    this.#heading(doc, 'Patrol coverage gaps');
    if (!report.coverage.available) {
      doc
        .fontSize(9)
        .fillColor(MUTED)
        .text('Patrol data (UC1) is not connected yet, so coverage is not available.');
      return;
    }
    this.#table(
      doc,
      ['Sector', 'Last patrolled', 'Days since patrol'],
      report.coverage.unpatrolledSectors.map((r) => [
        r.name,
        r.lastPatrolledAt ? new Date(r.lastPatrolledAt).toISOString().slice(0, 10) : 'Never',
        r.daysSincePatrol ?? '-',
      ]),
      [0.4, 0.3, 0.3],
    );
  }

  #trends(doc, report) {
    this.#heading(doc, 'Human-wildlife conflict by month');
    const { months, series, totals } = report.trends;
    this.#table(
      doc,
      ['Month', ...series.map((s) => typeLabel(s.type)), 'Total'],
      months.map((month, i) => [monthLabel(month), ...series.map((s) => s.counts[i]), totals[i]]),
      [0.16, ...series.map(() => 0.7 / series.length), 0.14],
    );
  }

  #incidentList(doc, report) {
    this.#heading(doc, 'Incident list (verified)');
    this.#table(
      doc,
      ['Reference', 'Type', 'Date', 'Village', 'Sector'],
      report.incidents.map((i) => [
        i.trackingCode ?? '-',
        typeLabel(i.incidentType),
        i.occurredAt ? new Date(i.occurredAt).toISOString().slice(0, 10) : '-',
        i.villageName ?? '-',
        i.sectorName ?? '-',
      ]),
      [0.15, 0.3, 0.17, 0.2, 0.18],
    );
  }
}

module.exports = { PdfExporter, VIRIDIS };
