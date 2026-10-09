const PDFDocument = require('pdfkit');
const { EXPORT_SECTIONS, ANALYTICS_RULES } = require('../../constants/domain');
const { typeLabel, monthLabel, kpiRows, reportFileName, REPORT_TYPE_LABELS } = require('./reportText');
const { project, chooseZoom, TILE_SIZE } = require('./mapTiles');

/** Viridis ramp, one colour per heatmap legend level (colour-blind safe; Crameri et al., 2020). */
const VIRIDIS = Object.freeze(['#3b528b', '#2c728e', '#21918c', '#5ec962', '#fde725']);
const INK = '#1f2a24';
const MUTED = '#5b6660';
const BRAND = '#1f6b3a';
const RULE = '#cfd8d2';
const ZEBRA = '#f3f7f4';
const LAND = '#eef3ee';
const PAGE_MARGIN = 48;
const FOOTER_HEIGHT = 24;
const CELL_PAD_X = 6;
const CELL_PAD_Y = 4;
const MAP_MAX_HEIGHT = 330;
const NUMERIC = /^(?:[-+]?\d[\d,.]*%?|-)$/;
const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

const printableWidth = (doc) => doc.page.width - PAGE_MARGIN * 2;
const pageBottom = (doc) => doc.page.height - PAGE_MARGIN - FOOTER_HEIGHT;

/**
 * Frame of the hotspot map in Web Mercator: the heatmap and park outline plus a small
 * margin, scaled to fit the page. Pure, so tiles can be fetched before drawing starts.
 */
function mapLayout(report, width) {
  const { bounds } = report.heatmap;
  const outline = report.park?.boundary ?? [];
  const lats = [bounds.minLat, bounds.maxLat, ...outline.map((p) => p.latitude)];
  const lngs = [bounds.minLng, bounds.maxLng, ...outline.map((p) => p.longitude)];
  const padLat = (Math.max(...lats) - Math.min(...lats)) * 0.04;
  const padLng = (Math.max(...lngs) - Math.min(...lngs)) * 0.04;
  const frame = {
    minLat: Math.min(...lats) - padLat,
    maxLat: Math.max(...lats) + padLat,
    minLng: Math.min(...lngs) - padLng,
    maxLng: Math.max(...lngs) + padLng,
  };
  // Two tile pixels per PDF point keeps the basemap sharp when printed.
  const zoom = chooseZoom(frame, width * 2);
  const topLeft = project(frame.minLng, frame.maxLat, zoom);
  const bottomRight = project(frame.maxLng, frame.minLat, zoom);
  const pixelBox = { minX: topLeft.x, minY: topLeft.y, maxX: bottomRight.x, maxY: bottomRight.y };
  const scale = Math.min(
    width / (pixelBox.maxX - pixelBox.minX),
    MAP_MAX_HEIGHT / (pixelBox.maxY - pixelBox.minY),
  );
  return {
    frame,
    zoom,
    pixelBox,
    scale,
    width: (pixelBox.maxX - pixelBox.minX) * scale,
    height: (pixelBox.maxY - pixelBox.minY) * scale,
  };
}

/** Largest round distance (m) not longer than `maxMetres`, for the scale bar. */
function niceDistance(maxMetres) {
  const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  return steps.filter((m) => m <= maxMetres).pop() ?? steps[0];
}

/** PdfExporter (ReportExporter strategy): printable report for ministries and donors. */
class PdfExporter {
  /**
   * @param {{ tileSource?: { getTiles: Function } | null }} [deps] Basemap tiles for the hotspot map.
   *   Without one the map is drawn on a plain background.
   */
  constructor({ tileSource = null } = {}) {
    this.tileSource = tileSource;
  }

  /**
   * @param {object} report ConservationReport.
   * @param {string[]} sections Values from EXPORT_SECTIONS.
   * @returns {Promise<{ filename: string, contentType: string, content: Buffer }>}
   */
  async export(report, sections) {
    const map = await this.#prepareMap(report, sections);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: PAGE_MARGIN,
        bufferPages: true,
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
      if (sections.includes(EXPORT_SECTIONS.HOTSPOT_MAP)) this.#hotspots(doc, report, map);
      if (sections.includes(EXPORT_SECTIONS.COVERAGE_GAPS)) this.#coverage(doc, report);
      if (sections.includes(EXPORT_SECTIONS.CONFLICT_TRENDS)) this.#trends(doc, report);
      if (sections.includes(EXPORT_SECTIONS.INCIDENT_LIST)) this.#incidentList(doc, report);
      this.#pageFooters(doc, report);
      doc.end();
    });
  }

  async #prepareMap(report, sections) {
    const heatmap = report.heatmap;
    if (!sections.includes(EXPORT_SECTIONS.HOTSPOT_MAP)) return null;
    if (!heatmap?.cells?.length || !heatmap.bounds || !heatmap.cellSizeDeg) return null;
    const layout = mapLayout(report, 595.28 - PAGE_MARGIN * 2);
    const tiles = this.tileSource ? await this.tileSource.getTiles(layout.pixelBox, layout.zoom) : null;
    return { ...layout, tiles };
  }

  #header(doc, report) {
    doc.font('Helvetica').fontSize(18).fillColor(BRAND).text('WildGuard LK - Conservation report');
    doc
      .moveDown(0.3)
      .fontSize(10)
      .fillColor(INK)
      .text(`${report.park?.name ?? report.parkId}  |  ${report.filter.dateFrom} to ${report.filter.dateTo}`)
      .text(`Report type: ${REPORT_TYPE_LABELS[report.filter.reportType] ?? report.filter.reportType}`)
      .fillColor(MUTED)
      .text(`Generated ${new Date(report.generatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`);
    const y = doc.y + 8;
    doc
      .moveTo(PAGE_MARGIN, y)
      .lineTo(PAGE_MARGIN + printableWidth(doc), y)
      .lineWidth(1)
      .stroke(BRAND);
    doc.y = y;
  }

  #heading(doc, text, keepWithNext = 90) {
    if (doc.y + keepWithNext > pageBottom(doc)) doc.addPage();
    doc.moveDown(1).font('Helvetica').fontSize(13).fillColor(BRAND).text(text, PAGE_MARGIN).moveDown(0.4);
  }

  #note(doc, text) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(text, PAGE_MARGIN, doc.y, { width: printableWidth(doc) });
  }

  /**
   * Bordered table with a filled header row and banded body rows. Widths are fractions of
   * the printable width; columns whose values are all numbers are right-aligned. The header
   * repeats when the table runs onto a new page.
   */
  #table(doc, header, rows, widths) {
    const total = printableWidth(doc);
    const colWidths = widths.map((w) => total * w);
    const align = header.map((_, i) =>
      rows.length && rows.every((r) => NUMERIC.test(String(r[i] ?? ''))) ? 'right' : 'left',
    );

    const rowHeight = (cells, font) => {
      doc.font(font).fontSize(9);
      return (
        Math.max(
          ...cells.map((cell, i) =>
            doc.heightOfString(String(cell ?? ''), { width: colWidths[i] - CELL_PAD_X * 2 }),
          ),
        ) +
        CELL_PAD_Y * 2
      );
    };

    const drawRow = (cells, y, height, { isHeader = false, banded = false } = {}) => {
      if (isHeader) doc.rect(PAGE_MARGIN, y, total, height).fill(BRAND);
      else if (banded) doc.rect(PAGE_MARGIN, y, total, height).fill(ZEBRA);
      let x = PAGE_MARGIN;
      cells.forEach((cell, i) => {
        doc
          .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(9)
          .fillColor(isHeader ? '#ffffff' : INK)
          .text(String(cell ?? ''), x + CELL_PAD_X, y + CELL_PAD_Y, {
            width: colWidths[i] - CELL_PAD_X * 2,
            align: align[i],
          });
        if (i > 0)
          doc
            .moveTo(x, y)
            .lineTo(x, y + height)
            .lineWidth(0.5)
            .stroke(isHeader ? BRAND : RULE);
        x += colWidths[i];
      });
      doc
        .moveTo(PAGE_MARGIN, y + height)
        .lineTo(PAGE_MARGIN + total, y + height)
        .lineWidth(0.5)
        .stroke(RULE);
    };

    const headerHeight = rowHeight(header, 'Helvetica-Bold');
    let segmentTop = doc.y;
    let y = doc.y;
    const closeSegment = () =>
      doc
        .rect(PAGE_MARGIN, segmentTop, total, y - segmentTop)
        .lineWidth(0.75)
        .stroke(RULE);
    const startSegment = () => {
      segmentTop = y;
      drawRow(header, y, headerHeight, { isHeader: true });
      y += headerHeight;
    };

    if (y + headerHeight + rowHeight(rows[0] ?? header, 'Helvetica') > pageBottom(doc)) {
      doc.addPage();
      y = doc.y;
    }
    startSegment();
    rows.forEach((cells, index) => {
      const height = rowHeight(cells, 'Helvetica');
      if (y + height > pageBottom(doc)) {
        closeSegment();
        doc.addPage();
        y = doc.y;
        startSegment();
      }
      drawRow(cells, y, height, { banded: index % 2 === 1 });
      y += height;
    });
    closeSegment();
    doc.font('Helvetica');
    doc.x = PAGE_MARGIN;
    doc.y = y + 4;
  }

  #kpis(doc, report) {
    this.#heading(doc, 'Summary');
    this.#table(doc, ['Metric', 'Value', 'Note'], kpiRows(report), [0.38, 0.17, 0.45]);
    this.#heading(doc, 'Incidents by type');
    this.#table(
      doc,
      ['Type', 'Count'],
      report.stats.byType.map((r) => [typeLabel(r.type), r.count]),
      [0.8, 0.2],
    );
  }

  #hotspots(doc, report, map) {
    const heatmap = report.heatmap;
    const height = map ? map.height + 30 : 90;
    this.#heading(doc, `Hotspots (kernel density, ${heatmap?.bandwidthMetres ?? '-'} m bandwidth)`, height);
    if (map) this.#drawMap(doc, report, map);
    else this.#note(doc, 'No incidents with a location in this period, so there is no hotspot map.');
    if (!report.topHotspots?.length) return;
    doc.moveDown(0.6);
    this.#table(
      doc,
      ['Area', 'Incidents', 'Main type'],
      report.topHotspots.map((r) => [r.area, r.incidents, typeLabel(r.mainType)]),
      [0.45, 0.17, 0.38],
    );
  }

  #drawMap(doc, report, map) {
    const { pixelBox, scale, zoom, tiles } = map;
    const { classBreaks, cellSizeDeg, cells } = report.heatmap;
    const left = PAGE_MARGIN + (printableWidth(doc) - map.width) / 2;
    const top = doc.y;
    const toPt = (longitude, latitude) => {
      const p = project(longitude, latitude, zoom);
      return { x: left + (p.x - pixelBox.minX) * scale, y: top + (p.y - pixelBox.minY) * scale };
    };

    doc.save();
    doc.rect(left, top, map.width, map.height).clip();
    doc.rect(left, top, map.width, map.height).fill(LAND);
    for (const tile of tiles ?? []) {
      doc.image(
        tile.image,
        left + (tile.x * TILE_SIZE - pixelBox.minX) * scale,
        top + (tile.y * TILE_SIZE - pixelBox.minY) * scale,
        {
          width: TILE_SIZE * scale,
          height: TILE_SIZE * scale,
        },
      );
    }

    // Heat cells are translucent over the basemap so roads and villages stay visible. Each
    // level is filled as one path, so the slight overlap between cells never shows as a seam.
    doc.fillOpacity(tiles ? 0.7 : 1);
    VIRIDIS.forEach((colour, level) => {
      const inLevel = cells.filter((cell) => (VIRIDIS[cell.level] ? cell.level : 0) === level);
      if (!inLevel.length) return;
      for (const cell of inLevel) {
        const a = toPt(cell.longitude - cellSizeDeg.longitude / 2, cell.latitude + cellSizeDeg.latitude / 2);
        const b = toPt(cell.longitude + cellSizeDeg.longitude / 2, cell.latitude - cellSizeDeg.latitude / 2);
        doc.rect(a.x, a.y, b.x - a.x + 0.3, b.y - a.y + 0.3);
      }
      doc.fill(colour);
    });
    doc.fillOpacity(1);

    const outline = report.park?.boundary ?? [];
    if (outline.length) {
      const first = toPt(outline[0].longitude, outline[0].latitude);
      doc.moveTo(first.x, first.y);
      outline.slice(1).forEach((p) => {
        const pt = toPt(p.longitude, p.latitude);
        doc.lineTo(pt.x, pt.y);
      });
      doc.closePath().lineWidth(1.5).dash(5, { space: 3 }).stroke(BRAND).undash();
    }

    for (const place of report.landmarks ?? []) {
      const pt = toPt(place.longitude, place.latitude);
      this.#plateText(doc, place.name, pt.x + 5, pt.y - 4, 7.5);
      doc.circle(pt.x, pt.y, 2.8).lineWidth(1).fillAndStroke(INK, '#ffffff');
    }

    this.#northArrow(doc, left + map.width - 22, top + 12);
    this.#scaleBar(doc, map, left + 8, top + map.height - 22);
    if (tiles) {
      doc.font('Helvetica').fontSize(6.5);
      this.#plateText(
        doc,
        OSM_ATTRIBUTION,
        left + map.width - doc.widthOfString(OSM_ATTRIBUTION) - 4,
        top + map.height - 10,
        6.5,
      );
    }
    doc.restore();
    doc.rect(left, top, map.width, map.height).lineWidth(0.75).stroke(RULE);

    let legendX = left;
    const legendY = top + map.height + 8;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(INK)
      .text('Incidents per km²:', legendX, legendY, { lineBreak: false });
    legendX += 74;
    classBreaks.forEach((value, index) => {
      const label = `${value}${index === classBreaks.length - 1 ? '+' : ''}`;
      doc.rect(legendX, legendY, 12, 8).fill(VIRIDIS[index]);
      doc.fillColor(INK).text(label, legendX + 15, legendY, { lineBreak: false });
      legendX += 22 + doc.widthOfString(label);
    });
    legendX += 8;
    doc
      .moveTo(legendX, legendY + 4)
      .lineTo(legendX + 16, legendY + 4)
      .lineWidth(1.5)
      .dash(5, { space: 3 })
      .stroke(BRAND)
      .undash();
    doc.fillColor(INK).text('Park boundary', legendX + 20, legendY, { lineBreak: false });
    if (!tiles) {
      doc
        .fillColor(MUTED)
        .text('Basemap unavailable; showing the park outline only.', left, legendY + 12, {
          lineBreak: false,
        });
    }
    doc.x = PAGE_MARGIN;
    doc.y = legendY + (tiles ? 14 : 26);
  }

  /** Text on a translucent white plate, readable over tiles and heat cells. */
  #plateText(doc, text, x, y, size) {
    doc.font('Helvetica').fontSize(size);
    doc
      .rect(x - 1.5, y - 1, doc.widthOfString(text) + 3, size + 2.5)
      .fillOpacity(0.85)
      .fill('#ffffff')
      .fillOpacity(1);
    doc.fillColor(INK).text(text, x, y, { lineBreak: false });
  }

  #northArrow(doc, x, y) {
    doc
      .rect(x - 9, y - 4, 18, 26)
      .fillOpacity(0.85)
      .fill('#ffffff')
      .fillOpacity(1);
    doc.polygon([x, y], [x + 5, y + 12], [x, y + 9], [x - 5, y + 12]).fill(INK);
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(INK)
      .text('N', x - 2.5, y + 13, { lineBreak: false });
  }

  #scaleBar(doc, map, x, y) {
    const centreLat = (map.frame.minLat + map.frame.maxLat) / 2;
    const metresPerPoint = (156543.03392 * Math.cos((centreLat * Math.PI) / 180)) / 2 ** map.zoom / map.scale;
    const metres = niceDistance((map.width / 5) * metresPerPoint);
    const length = metres / metresPerPoint;
    const label = metres >= 1000 ? `${metres / 1000} km` : `${metres} m`;
    doc.font('Helvetica').fontSize(7);
    doc
      .rect(x - 4, y - 4, length + doc.widthOfString(label) + 14, 16)
      .fillOpacity(0.85)
      .fill('#ffffff')
      .fillOpacity(1);
    doc.rect(x, y + 2, length / 2, 4).fill(INK);
    doc
      .rect(x + length / 2, y + 2, length / 2, 4)
      .lineWidth(0.75)
      .fillAndStroke('#ffffff', INK);
    doc.fillColor(INK).text(label, x + length + 5, y + 1, { lineBreak: false });
  }

  #coverage(doc, report) {
    this.#heading(doc, 'Patrol coverage gaps');
    if (!report.coverage.available) {
      this.#note(doc, 'Patrol data (UC1) is not connected yet, so coverage is not available.');
      return;
    }
    if (!report.coverage.unpatrolledSectors.length) {
      this.#note(doc, `Every sector was patrolled within the last ${ANALYTICS_RULES.UNPATROLLED_DAYS} days.`);
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
    if (!months.length) {
      this.#note(doc, 'No months in this period.');
      return;
    }
    this.#table(
      doc,
      ['Month', ...series.map((s) => typeLabel(s.type)), 'Total'],
      months.map((month, i) => [monthLabel(month), ...series.map((s) => s.counts[i]), totals[i]]),
      [0.16, ...series.map(() => 0.7 / series.length), 0.14],
    );
  }

  #incidentList(doc, report) {
    this.#heading(doc, 'Incident list (verified)');
    if (!report.incidents?.length) {
      this.#note(doc, 'No verified incidents in this period.');
      return;
    }
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
      [0.17, 0.3, 0.15, 0.2, 0.18],
    );
  }

  /** "Page n of m" plus the report scope on every page. */
  #pageFooters(doc, report) {
    const { start, count } = doc.bufferedPageRange();
    const scope = `WildGuard LK  |  ${report.park?.name ?? report.parkId}  |  ${report.filter.dateFrom} to ${report.filter.dateTo}`;
    for (let i = start; i < start + count; i += 1) {
      doc.switchToPage(i);
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const y = doc.page.height - PAGE_MARGIN + 6;
      doc
        .moveTo(PAGE_MARGIN, y - 6)
        .lineTo(PAGE_MARGIN + printableWidth(doc), y - 6)
        .lineWidth(0.5)
        .stroke(RULE);
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED);
      doc.text(scope, PAGE_MARGIN, y, { lineBreak: false });
      doc.text(`Page ${i - start + 1} of ${count}`, PAGE_MARGIN, y, {
        width: printableWidth(doc),
        align: 'right',
      });
      doc.page.margins.bottom = bottomMargin;
    }
  }
}

module.exports = { PdfExporter, VIRIDIS, mapLayout, niceDistance };
