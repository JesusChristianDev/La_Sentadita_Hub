import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { EmployeeListItem } from '@/modules/employees';

import type { RestaurantZone, ScheduleEntry } from '../domain/scheduleTypes';
import { formatWeekRange, parseScheduleLocalDate } from './scheduleEditorHelpers';

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN_X = 22;
const MARGIN_BOTTOM = 22;
const TABLE_TOP = 96;
const HEADER_PANEL_TOP = 18;
const HEADER_PANEL_HEIGHT = 52;
const HEADER_ROW_HEIGHT = 24;
const SECTION_ROW_HEIGHT = 20;
const SPACER_ROW_HEIGHT = 6;
const CELL_PADDING_X = 4.5;
const CELL_PADDING_Y = 3.2;
const MIN_EMPLOYEE_ROW_HEIGHT = 26;
const LINE_HEIGHT = 7;
const PANEL_LABEL_FONT_SIZE = 6.4;
const SECTION_FONT_SIZE = 8.8;
const HEADER_FONT_SIZE = 7.4;
const EMPLOYEE_FONT_SIZE = 8.8;
const DAY_FONT_SIZE = 6.8;
const WORK_FONT_SIZE = 7.1;
const HOURS_FONT_SIZE = 8.2;

type RgbColor = [number, number, number];
type TextAlign = 'center' | 'left';

type SchedulePdfParams = {
  employees: EmployeeListItem[];
  entries: ScheduleEntry[];
  scopeLabel: string;
  weekStart: string;
  zones: RestaurantZone[];
};

type PdfColumn = {
  align: TextAlign;
  fontSize: number;
  key: string;
  label: string;
  width: number;
};

type PdfCell = {
  align?: TextAlign;
  borderColor?: RgbColor;
  fillColor?: RgbColor;
  font: 'F1' | 'F2';
  fontSize: number;
  insetBorderColor?: RgbColor;
  insetFillColor?: RgbColor;
  insetPadding?: number;
  leftAccentColor?: RgbColor;
  lines: string[];
  textColor?: RgbColor;
};

type PdfEmployeeRow = {
  cells: PdfCell[];
  height: number;
  type: 'employee';
};

type PdfSectionRow = {
  height: number;
  label: string;
  markerColor: RgbColor;
  type: 'section';
};

type PdfSpacerRow = {
  height: number;
  type: 'spacer';
};

type PdfRow = PdfEmployeeRow | PdfSectionRow | PdfSpacerRow;

type PdfPage = {
  rows: PdfRow[];
};

type ZonePalette = {
  markerColor: RgbColor;
};

type ZoneGroup = {
  employees: EmployeeListItem[];
  label: string;
  palette: ZonePalette;
};

const WHITE: RgbColor = [1, 1, 1];
const TEXT_DEFAULT: RgbColor = [0.12, 0.14, 0.16];
const TEXT_MUTED: RgbColor = [0.27, 0.31, 0.36];
const HEADER_PANEL_FILL: RgbColor = [0.968, 0.973, 0.98];
const HEADER_CARD_FILL: RgbColor = WHITE;
const HEADER_BORDER: RgbColor = [0.77, 0.81, 0.86];
const GRID_STROKE: RgbColor = [0.74, 0.78, 0.83];
const TABLE_HEADER_FILL: RgbColor = [0.93, 0.941, 0.954];
const SECTION_FILL: RgbColor = [0.944, 0.952, 0.962];
const EMPLOYEE_NAME_FILL: RgbColor = [0.972, 0.977, 0.983];
const EMPLOYEE_NAME_TEXT: RgbColor = [0.13, 0.15, 0.18];
const EMPLOYEE_NAME_BORDER: RgbColor = [0.77, 0.81, 0.86];
const HOURS_FILL: RgbColor = [0.943, 0.957, 0.975];
const HOURS_BORDER: RgbColor = [0.69, 0.76, 0.86];
const WORK_FILL: RgbColor = [0.962, 0.974, 0.989];
const WORK_TEXT: RgbColor = [0.08, 0.15, 0.27];
const WORK_BORDER: RgbColor = [0.63, 0.72, 0.84];
const UNSCHEDULED_FILL: RgbColor = [0.914, 0.922, 0.934];

const PDF_DAY_TYPE_LABEL: Partial<Record<ScheduleEntry['day_type'], string>> = {
  absent: 'Ausencia',
  end_of_contract: 'Fin contrato',
  not_applicable: 'N/A',
  rest: 'Libre',
  sick_leave: 'Baja',
  unscheduled: 'Sin horario',
  vacation: 'Vacaciones',
};

const DAY_STATUS_STYLES: Partial<
  Record<ScheduleEntry['day_type'], { fill: RgbColor; text: RgbColor }>
> = {
  absent: { fill: [0.885, 0.872, 0.975], text: [0.27, 0.19, 0.47] },
  end_of_contract: { fill: [0.89, 0.895, 0.905], text: [0.25, 0.28, 0.32] },
  not_applicable: { fill: [0.89, 0.895, 0.905], text: [0.25, 0.28, 0.32] },
  rest: { fill: [0.855, 0.927, 0.979], text: [0.08, 0.28, 0.42] },
  sick_leave: { fill: [0.988, 0.872, 0.886], text: [0.47, 0.12, 0.15] },
  unscheduled: { fill: UNSCHEDULED_FILL, text: [0.29, 0.32, 0.36] },
  vacation: { fill: [0.985, 0.928, 0.765], text: [0.48, 0.29, 0.02] },
};

const ZONE_PALETTE: ZonePalette[] = [
  {
    markerColor: [0.39, 0.5, 0.67],
  },
  {
    markerColor: [0.33, 0.56, 0.53],
  },
  {
    markerColor: [0.62, 0.48, 0.31],
  },
  {
    markerColor: [0.48, 0.43, 0.66],
  },
  {
    markerColor: [0.44, 0.53, 0.28],
  },
  {
    markerColor: [0.43, 0.49, 0.57],
  },
];

const UNASSIGNED_ZONE_PALETTE: ZonePalette = {
  markerColor: [0.52, 0.55, 0.59],
};

export function createSchedulePdfFileName(params: {
  scopeLabel: string;
  weekStart: string;
}) {
  const scopeSegment = sanitizeFileSegment(normalizeScopeLabel(params.scopeLabel)) || 'completo';

  return `horario-${params.weekStart}-${scopeSegment}.pdf`;
}

export function buildSchedulePdfDocument(params: SchedulePdfParams): ArrayBuffer {
  const effectiveScopeLabel = normalizeScopeLabel(params.scopeLabel);
  const dayColumns = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(parseScheduleLocalDate(params.weekStart), index);

    return {
      iso: format(date, 'yyyy-MM-dd'),
      label: capitalizeLabel(format(date, "EEE dd/MM", { locale: es })),
    };
  });
  const columns: PdfColumn[] = [
    {
      align: 'left',
      fontSize: EMPLOYEE_FONT_SIZE,
      key: 'employee',
      label: 'Empleado',
      width: 194,
    },
    ...dayColumns.map((day) => ({
      align: 'center' as const,
      fontSize: HEADER_FONT_SIZE,
      key: day.iso,
      label: day.label,
      width: 75,
    })),
    {
      align: 'center',
      fontSize: HOURS_FONT_SIZE,
      key: 'hours',
      label: 'Horas',
      width: 68,
    },
  ];
  const entriesMap = new Map(
    params.entries.map((entry) => [`${entry.employee_id}::${entry.date}`, entry] as const),
  );
  const groups = buildZoneGroups(params);
  const pages = paginateGroups({
    columns,
    dayColumns,
    entriesMap,
    groups,
  });
  const title = `Horario ${formatWeekRange(params.weekStart)}`;
  const generatedAt = format(new Date(), 'dd/MM/yyyy HH:mm');
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const pageContents = pages.map((page, pageIndex) =>
    buildPdfPageContent({
      columns,
      generatedAt,
      page,
      pageNumber: pageIndex + 1,
      scopeLabel: effectiveScopeLabel,
      subtitle: 'Planificacion operativa por zonas',
      tableWidth,
      title,
      totalPages: pages.length,
    }),
  );
  const bytes = assemblePdf(pageContents);
  const buffer = new Uint8Array(bytes.byteLength);

  buffer.set(bytes);

  return buffer.buffer;
}

function buildZoneGroups(params: SchedulePdfParams): ZoneGroup[] {
  const employeesByZone = new Map<string, EmployeeListItem[]>();
  const unassignedEmployees: EmployeeListItem[] = [];

  params.employees.forEach((employee) => {
    if (!employee.zone_id) {
      unassignedEmployees.push(employee);
      return;
    }

    const existing = employeesByZone.get(employee.zone_id) ?? [];

    existing.push(employee);
    employeesByZone.set(employee.zone_id, existing);
  });

  const groups = params.zones
    .map((zone, index) => {
      const employees = sortEmployees(employeesByZone.get(zone.id) ?? []);
      if (!employees.length) return null;

      return {
        employees,
        label: zone.name,
        palette: ZONE_PALETTE[index % ZONE_PALETTE.length],
      } satisfies ZoneGroup;
    })
    .filter((group): group is ZoneGroup => Boolean(group));

  if (unassignedEmployees.length) {
    groups.push({
      employees: sortEmployees(unassignedEmployees),
      label: 'Sin zona asignada',
      palette: UNASSIGNED_ZONE_PALETTE,
    });
  }

  return groups;
}

function paginateGroups(params: {
  columns: PdfColumn[];
  dayColumns: Array<{ iso: string; label: string }>;
  entriesMap: Map<string, ScheduleEntry>;
  groups: ZoneGroup[];
}) {
  const pages: PdfPage[] = [{ rows: [] }];
  const maxRowsHeight = PAGE_HEIGHT - TABLE_TOP - MARGIN_BOTTOM - HEADER_ROW_HEIGHT;
  let currentPage = pages[0];
  let currentHeight = 0;

  const startNewPage = () => {
    currentPage = { rows: [] };
    pages.push(currentPage);
    currentHeight = 0;
  };

  const pushRow = (row: PdfRow) => {
    currentPage.rows.push(row);
    currentHeight += row.height;
  };

  params.groups.forEach((group, groupIndex) => {
    const sectionLabel = group.label;
    const employeeRows = group.employees.map((employee) =>
      buildEmployeeRow({
        columns: params.columns,
        dayColumns: params.dayColumns,
        employee,
        entriesMap: params.entriesMap,
        palette: group.palette,
      }),
    );
    const previewRowsHeight = employeeRows
      .slice(0, Math.min(employeeRows.length, 2))
      .reduce((sum, row) => sum + row.height, 0);

    if (
      currentHeight > 0 &&
      currentHeight + SECTION_ROW_HEIGHT + previewRowsHeight > maxRowsHeight
    ) {
      startNewPage();
    }

    pushRow(buildSectionRow(sectionLabel, group.palette));

    employeeRows.forEach((row, rowIndex) => {
      const nextRow = employeeRows[rowIndex + 1];
      const hasMoreRowsAfterCurrent = rowIndex < employeeRows.length - 1;

      if (
        hasMoreRowsAfterCurrent &&
        currentPage.rows.length > 1 &&
        currentHeight + row.height + (nextRow?.height ?? 0) > maxRowsHeight
      ) {
        startNewPage();
        pushRow(buildSectionRow(`${sectionLabel} (cont.)`, group.palette));
      }

      if (currentHeight + row.height > maxRowsHeight && currentPage.rows.length > 1) {
        startNewPage();
        pushRow(buildSectionRow(`${sectionLabel} (cont.)`, group.palette));
      }

      pushRow(row);
    });

    if (groupIndex < params.groups.length - 1) {
      if (currentHeight + SPACER_ROW_HEIGHT > maxRowsHeight && currentHeight > 0) {
        startNewPage();
      } else {
        pushRow({ height: SPACER_ROW_HEIGHT, type: 'spacer' });
      }
    }
  });

  return pages;
}

function buildSectionRow(label: string, palette: ZonePalette): PdfSectionRow {
  return {
    height: SECTION_ROW_HEIGHT,
    label: formatSectionLabel(label),
    markerColor: palette.markerColor,
    type: 'section',
  };
}

function buildEmployeeRow(params: {
  columns: PdfColumn[];
  dayColumns: Array<{ iso: string; label: string }>;
  employee: EmployeeListItem;
  entriesMap: Map<string, ScheduleEntry>;
  palette: ZonePalette;
}): PdfEmployeeRow {
  const dayCells = params.dayColumns.map((day, index) => {
    const entry = params.entriesMap.get(`${params.employee.id}::${day.iso}`);

    return buildDayCell({
      entry,
      width: params.columns[index + 1]?.width ?? 0,
    });
  });
  const totalHours = dayCells.reduce((sum, cell) => sum + cell.hours, 0);
  const cells: PdfCell[] = [
    {
      borderColor: EMPLOYEE_NAME_BORDER,
      fillColor: EMPLOYEE_NAME_FILL,
      font: 'F2',
      fontSize: EMPLOYEE_FONT_SIZE,
      leftAccentColor: params.palette.markerColor,
      lines: wrapTextToFit(
        params.employee.full_name,
        params.columns[0]?.width ?? 0,
        EMPLOYEE_FONT_SIZE,
        3,
      ),
      textColor: EMPLOYEE_NAME_TEXT,
    },
    ...dayCells.map((cell) => cell.cell),
    {
      align: 'center',
      borderColor: HOURS_BORDER,
      fillColor: HOURS_FILL,
      font: 'F2',
      fontSize: HOURS_FONT_SIZE,
      lines: [formatHours(totalHours)],
      textColor: TEXT_DEFAULT,
    },
  ];
  const maxLines = Math.max(...cells.map((cell) => Math.max(cell.lines.length, 1)));

  return {
    cells,
    height: Math.max(
      MIN_EMPLOYEE_ROW_HEIGHT,
      CELL_PADDING_Y * 2 + maxLines * LINE_HEIGHT + 2,
    ),
    type: 'employee',
  };
}

function buildDayCell(params: { entry?: ScheduleEntry; width: number }) {
  if (!params.entry || params.entry.day_type === 'unscheduled') {
    return {
      cell: {
        align: 'center' as const,
        fillColor: UNSCHEDULED_FILL,
        font: 'F1' as const,
        fontSize: DAY_FONT_SIZE,
        lines: ['Sin horario'],
        textColor: DAY_STATUS_STYLES.unscheduled?.text ?? TEXT_MUTED,
      },
      hours: 0,
    };
  }

  if (params.entry.day_type === 'work') {
    const lines = formatWorkEntryLines(params.entry).map((line) =>
      truncateTextToFit(line, params.width - 6, WORK_FONT_SIZE),
    );

    return {
      cell: {
        align: 'center' as const,
        borderColor: WORK_BORDER,
        fillColor: WORK_FILL,
        font: 'F2' as const,
        fontSize: WORK_FONT_SIZE,
        lines,
        textColor: WORK_TEXT,
      },
      hours: getEntryHours(params.entry),
    };
  }

  const style = DAY_STATUS_STYLES[params.entry.day_type];
  const label = PDF_DAY_TYPE_LABEL[params.entry.day_type] ?? '-';

  return {
    cell: {
      align: 'center' as const,
      fillColor: style?.fill,
      font: 'F1' as const,
      fontSize: DAY_FONT_SIZE,
      lines: [truncateTextToFit(label, params.width, DAY_FONT_SIZE)],
      textColor: style?.text ?? TEXT_DEFAULT,
    },
    hours: 0,
  };
}

function buildPdfPageContent(params: {
  columns: PdfColumn[];
  generatedAt: string;
  page: PdfPage;
  pageNumber: number;
  scopeLabel: string;
  subtitle: string;
  tableWidth: number;
  title: string;
  totalPages: number;
}) {
  const commands: string[] = [];

  drawHeaderPanel(commands, {
    generatedAt: params.generatedAt,
    pageNumber: params.pageNumber,
    scopeLabel: params.scopeLabel,
    subtitle: params.subtitle,
    tableWidth: params.tableWidth,
    title: params.title,
    totalPages: params.totalPages,
  });
  drawText(commands, {
    color: TEXT_MUTED,
    font: 'F2',
    fontSize: PANEL_LABEL_FONT_SIZE,
    text: 'ESTADOS',
    x: MARGIN_X,
    yTop: 78,
  });
  drawLegend(commands, MARGIN_X + 48, 72);
  drawHorizontalRule(commands, 90, params.tableWidth);
  drawFilledRect(commands, {
    color: TABLE_HEADER_FILL,
    height: HEADER_ROW_HEIGHT,
    width: params.tableWidth,
    x: MARGIN_X,
    yTop: TABLE_TOP,
  });

  let currentX = MARGIN_X;
  params.columns.forEach((column) => {
    drawRect(commands, {
      color: GRID_STROKE,
      height: HEADER_ROW_HEIGHT,
      width: column.width,
      x: currentX,
      yTop: TABLE_TOP,
    });
    drawText(commands, {
      align: column.align,
      color: TEXT_MUTED,
      font: 'F2',
      fontSize: column.fontSize,
      text: column.label,
      width: column.width - CELL_PADDING_X * 2,
      x: currentX + CELL_PADDING_X,
      yTop: TABLE_TOP + 8,
    });
    currentX += column.width;
  });

  let currentTop = TABLE_TOP + HEADER_ROW_HEIGHT;
  params.page.rows.forEach((row) => {
    if (row.type === 'spacer') {
      currentTop += row.height;
      return;
    }

    if (row.type === 'section') {
      drawFilledRect(commands, {
        color: SECTION_FILL,
        height: row.height,
        width: params.tableWidth,
        x: MARGIN_X,
        yTop: currentTop,
      });
      drawFilledRect(commands, {
        color: row.markerColor,
        height: row.height,
        width: 5,
        x: MARGIN_X,
        yTop: currentTop,
      });
      drawRect(commands, {
        color: HEADER_BORDER,
        height: row.height,
        width: params.tableWidth,
        x: MARGIN_X,
        yTop: currentTop,
      });
      drawText(commands, {
        color: TEXT_DEFAULT,
        font: 'F2',
        fontSize: SECTION_FONT_SIZE,
        text: row.label,
        x: MARGIN_X + 12,
        yTop: currentTop + 6,
      });
      currentTop += row.height;
      return;
    }

    let columnX = MARGIN_X;

    row.cells.forEach((cell, cellIndex) => {
      const column = params.columns[cellIndex];
      const lines = cell.lines.filter((line) => line.trim().length > 0);
      const contentLineCount = Math.max(lines.length, 1);
      const contentHeight = contentLineCount * LINE_HEIGHT;
      const insetPadding = cell.insetPadding ?? 0;
      const leftAccentWidth = cell.leftAccentColor ? 4 : 0;
      const textInsetX = CELL_PADDING_X + leftAccentWidth + (leftAccentWidth ? 4 : 0);
      const textWidth =
        (column?.width ?? 0) - textInsetX - CELL_PADDING_X - insetPadding * 2;
      const textStartTop = currentTop + Math.max(
        CELL_PADDING_Y + insetPadding / 2,
        (row.height - contentHeight) / 2 - 1,
      );

      if (cell.fillColor) {
        drawFilledRect(commands, {
          color: cell.fillColor,
          height: row.height,
          width: column?.width ?? 0,
          x: columnX,
          yTop: currentTop,
        });
      }

      if (cell.leftAccentColor) {
        drawFilledRect(commands, {
          color: cell.leftAccentColor,
          height: row.height,
          width: leftAccentWidth,
          x: columnX,
          yTop: currentTop,
        });
      }

      if (cell.insetFillColor) {
        drawFilledRect(commands, {
          color: cell.insetFillColor,
          height: Math.max(row.height - insetPadding * 2, 1),
          width: Math.max((column?.width ?? 0) - insetPadding * 2, 1),
          x: columnX + insetPadding,
          yTop: currentTop + insetPadding,
        });
      }

      if (cell.insetBorderColor) {
        drawRect(commands, {
          color: cell.insetBorderColor,
          height: Math.max(row.height - insetPadding * 2, 1),
          width: Math.max((column?.width ?? 0) - insetPadding * 2, 1),
          x: columnX + insetPadding,
          yTop: currentTop + insetPadding,
        });
      }

      drawRect(commands, {
        color: cell.borderColor ?? GRID_STROKE,
        height: row.height,
        width: column?.width ?? 0,
        x: columnX,
        yTop: currentTop,
      });

      lines.forEach((line, lineIndex) => {
        drawText(commands, {
          align: cell.align ?? column?.align ?? 'left',
          color: cell.textColor ?? TEXT_DEFAULT,
          font: cell.font,
          fontSize: cell.fontSize,
          text: line,
          width: Math.max(textWidth, 1),
          x: columnX + textInsetX,
          yTop: textStartTop + lineIndex * LINE_HEIGHT,
        });
      });

      columnX += column?.width ?? 0;
    });

    currentTop += row.height;
  });

  return commands.join('\n');
}

function drawHeaderPanel(
  commands: string[],
  params: {
    generatedAt: string;
    pageNumber: number;
    scopeLabel: string;
    subtitle: string;
    tableWidth: number;
    title: string;
    totalPages: number;
  },
) {
  const panelX = MARGIN_X;
  const panelYTop = HEADER_PANEL_TOP;
  const panelWidth = params.tableWidth;
  const cardGap = 8;
  const pageCardWidth = 72;
  const generatedCardWidth = 114;
  const scopeCardWidth = 124;
  const cardsWidth =
    scopeCardWidth + generatedCardWidth + pageCardWidth + cardGap * 2;
  const cardsX = panelX + panelWidth - cardsWidth - 12;
  const cardYTop = panelYTop + 12;

  drawFilledRect(commands, {
    color: HEADER_PANEL_FILL,
    height: HEADER_PANEL_HEIGHT,
    width: panelWidth,
    x: panelX,
    yTop: panelYTop,
  });
  drawRect(commands, {
    color: HEADER_BORDER,
    height: HEADER_PANEL_HEIGHT,
    width: panelWidth,
    x: panelX,
    yTop: panelYTop,
  });
  drawText(commands, {
    color: TEXT_MUTED,
    font: 'F2',
    fontSize: PANEL_LABEL_FONT_SIZE,
    text: 'PLANIFICACION SEMANAL',
    x: panelX + 12,
    yTop: panelYTop + 9,
  });
  drawText(commands, {
    color: TEXT_DEFAULT,
    font: 'F2',
    fontSize: 16.8,
    text: params.title,
    x: panelX + 12,
    yTop: panelYTop + 18,
  });
  drawText(commands, {
    color: TEXT_MUTED,
    font: 'F1',
    fontSize: 8.3,
    text: params.subtitle,
    x: panelX + 12,
    yTop: panelYTop + 39,
  });

  drawMetaCard(commands, {
    label: 'Alcance',
    value: truncateTextToFit(params.scopeLabel, scopeCardWidth - 16, 8.2),
    width: scopeCardWidth,
    x: cardsX,
    yTop: cardYTop,
  });
  drawMetaCard(commands, {
    label: 'Generado',
    value: params.generatedAt,
    width: generatedCardWidth,
    x: cardsX + scopeCardWidth + cardGap,
    yTop: cardYTop,
  });
  drawMetaCard(commands, {
    label: 'Pagina',
    value: `${params.pageNumber}/${params.totalPages}`,
    width: pageCardWidth,
    x: cardsX + scopeCardWidth + generatedCardWidth + cardGap * 2,
    yTop: cardYTop,
  });
}

function drawMetaCard(
  commands: string[],
  params: {
    label: string;
    value: string;
    width: number;
    x: number;
    yTop: number;
  },
) {
  drawFilledRect(commands, {
    color: HEADER_CARD_FILL,
    height: 28,
    width: params.width,
    x: params.x,
    yTop: params.yTop,
  });
  drawRect(commands, {
    color: HEADER_BORDER,
    height: 28,
    width: params.width,
    x: params.x,
    yTop: params.yTop,
  });
  drawText(commands, {
    color: TEXT_MUTED,
    font: 'F2',
    fontSize: 5.9,
    text: params.label.toUpperCase(),
    x: params.x + 7,
    yTop: params.yTop + 5,
  });
  drawText(commands, {
    color: TEXT_DEFAULT,
    font: 'F2',
    fontSize: 8.2,
    text: params.value,
    x: params.x + 7,
    yTop: params.yTop + 15,
  });
}

function drawLegend(commands: string[], x: number, yTop: number) {
  const items: Array<{ color: RgbColor; label: string; textColor?: RgbColor }> = [
    {
      color: DAY_STATUS_STYLES.rest?.fill ?? [1, 1, 1],
      label: 'Libre',
      textColor: DAY_STATUS_STYLES.rest?.text,
    },
    {
      color: DAY_STATUS_STYLES.vacation?.fill ?? [1, 1, 1],
      label: 'Vacaciones',
      textColor: DAY_STATUS_STYLES.vacation?.text,
    },
    {
      color: DAY_STATUS_STYLES.sick_leave?.fill ?? [1, 1, 1],
      label: 'Baja',
      textColor: DAY_STATUS_STYLES.sick_leave?.text,
    },
    {
      color: DAY_STATUS_STYLES.absent?.fill ?? [1, 1, 1],
      label: 'Ausencia',
      textColor: DAY_STATUS_STYLES.absent?.text,
    },
    {
      color: DAY_STATUS_STYLES.unscheduled?.fill ?? [1, 1, 1],
      label: 'Sin horario',
      textColor: DAY_STATUS_STYLES.unscheduled?.text,
    },
  ];
  let currentX = x;

  items.forEach((item) => {
    const width = Math.max(52, estimateTextWidth(item.label, 6.9) + 20);

    drawFilledRect(commands, {
      color: item.color,
      height: 14,
      width,
      x: currentX,
      yTop,
    });
    drawRect(commands, {
      color: HEADER_BORDER,
      height: 14,
      width,
      x: currentX,
      yTop,
    });
    drawText(commands, {
      align: 'center',
      color: item.textColor ?? TEXT_DEFAULT,
      font: 'F2',
      fontSize: 6.9,
      text: item.label,
      width: width - 8,
      x: currentX + 4,
      yTop: yTop + 4,
    });
    currentX += width + 6;
  });
}

function assemblePdf(pageContents: string[]) {
  const objects = new Map<number, string>();
  const pageRefs = pageContents.map((_, index) => 5 + index * 2);
  const pdfHeader = `%PDF-1.4\n%${String.fromCharCode(255, 255, 255, 255)}\n`;

  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(
    2,
    `<< /Type /Pages /Count ${pageContents.length} /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] >>`,
  );
  objects.set(
    3,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  );
  objects.set(
    4,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  );

  pageContents.forEach((content, index) => {
    const pageObjectNumber = 5 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const contentLength = toPdfBytes(content).length;

    objects.set(
      pageObjectNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatPdfNumber(PAGE_WIDTH)} ${formatPdfNumber(PAGE_HEIGHT)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    objects.set(
      contentObjectNumber,
      `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`,
    );
  });

  const objectNumbers = [...objects.keys()].sort((left, right) => left - right);
  const chunks = [pdfHeader];
  const offsets: number[] = [0];
  let byteOffset = toPdfBytes(chunks[0]).length;

  objectNumbers.forEach((objectNumber) => {
    const chunk = `${objectNumber} 0 obj\n${objects.get(objectNumber)}\nendobj\n`;

    offsets[objectNumber] = byteOffset;
    chunks.push(chunk);
    byteOffset += toPdfBytes(chunk).length;
  });

  const xrefOffset = byteOffset;
  const xref = [
    `xref\n0 ${objectNumbers.length + 1}\n`,
    '0000000000 65535 f \n',
    ...objectNumbers.map(
      (objectNumber) =>
        `${String(offsets[objectNumber] ?? 0).padStart(10, '0')} 00000 n \n`,
    ),
  ].join('');
  const trailer = `trailer\n<< /Size ${objectNumbers.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  chunks.push(xref, trailer);

  return toPdfBytes(chunks.join(''));
}

function formatWorkEntryLines(entry: ScheduleEntry) {
  const firstRange = `${entry.start_time?.slice(0, 5) ?? ''}-${entry.end_time?.slice(0, 5) ?? ''}`;

  if (!entry.split_start_time || !entry.split_end_time) {
    return [firstRange];
  }

  return [
    firstRange,
    `${entry.split_start_time.slice(0, 5)}-${entry.split_end_time.slice(0, 5)}`,
  ];
}

function getEntryHours(entry?: ScheduleEntry): number {
  if (!entry || entry.day_type !== 'work' || !entry.start_time || !entry.end_time) {
    return 0;
  }

  const primary = diffMinutes(entry.start_time, entry.end_time);
  const split =
    entry.split_start_time && entry.split_end_time
      ? diffMinutes(entry.split_start_time, entry.split_end_time)
      : 0;

  return (primary + split) / 60;
}

function diffMinutes(start: string, end: string) {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  const raw = endMinutes - startMinutes;

  return raw <= 0 ? raw + 24 * 60 : raw;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);

  return hours * 60 + minutes;
}

function formatHours(hours: number): string {
  if (hours === 0) return '0 h';
  if (Number.isInteger(hours)) return `${hours} h`;
  return `${hours.toFixed(1)} h`;
}

function sortEmployees(employees: EmployeeListItem[]) {
  return [...employees].sort((left, right) =>
    left.full_name.localeCompare(right.full_name, 'es'),
  );
}

function drawHorizontalRule(commands: string[], yTop: number, width = PAGE_WIDTH - MARGIN_X * 2) {
  const pdfY = PAGE_HEIGHT - yTop;

  commands.push('0.9 w');
  commands.push(`${toPdfColorCommand(GRID_STROKE, 'stroke')}`);
  commands.push(
    `${formatPdfNumber(MARGIN_X)} ${formatPdfNumber(pdfY)} m ${formatPdfNumber(MARGIN_X + width)} ${formatPdfNumber(pdfY)} l S`,
  );
  commands.push(`${toPdfColorCommand(TEXT_DEFAULT, 'stroke')}`);
}

function drawFilledRect(
  commands: string[],
  params: { color: RgbColor; height: number; width: number; x: number; yTop: number },
) {
  const y = PAGE_HEIGHT - params.yTop - params.height;

  commands.push(`${toPdfColorCommand(params.color, 'fill')}`);
  commands.push(
    `${formatPdfNumber(params.x)} ${formatPdfNumber(y)} ${formatPdfNumber(params.width)} ${formatPdfNumber(params.height)} re f`,
  );
  commands.push(`${toPdfColorCommand(TEXT_DEFAULT, 'fill')}`);
}

function drawRect(
  commands: string[],
  params: { color: RgbColor; height: number; width: number; x: number; yTop: number },
) {
  const y = PAGE_HEIGHT - params.yTop - params.height;

  commands.push('0.55 w');
  commands.push(`${toPdfColorCommand(params.color, 'stroke')}`);
  commands.push(
    `${formatPdfNumber(params.x)} ${formatPdfNumber(y)} ${formatPdfNumber(params.width)} ${formatPdfNumber(params.height)} re S`,
  );
  commands.push(`${toPdfColorCommand(TEXT_DEFAULT, 'stroke')}`);
}

function drawText(
  commands: string[],
  params: {
    align?: TextAlign;
    color?: RgbColor;
    font: 'F1' | 'F2';
    fontSize: number;
    text: string;
    width?: number;
    x: number;
    yTop: number;
  },
) {
  const pdfY = PAGE_HEIGHT - params.yTop - params.fontSize;
  const safeText = escapePdfText(normalizePdfText(params.text));
  const estimatedWidth = estimateTextWidth(params.text, params.fontSize);
  const width = params.width ?? estimatedWidth;
  const textX =
    params.align === 'center'
      ? params.x + Math.max((width - estimatedWidth) / 2, 0)
      : params.x;

  commands.push(`${toPdfColorCommand(params.color ?? TEXT_DEFAULT, 'fill')}`);
  commands.push(
    `BT /${params.font} ${formatPdfNumber(params.fontSize)} Tf 1 0 0 1 ${formatPdfNumber(textX)} ${formatPdfNumber(pdfY)} Tm (${safeText}) Tj ET`,
  );
  commands.push(`${toPdfColorCommand(TEXT_DEFAULT, 'fill')}`);
}

function estimateTextWidth(text: string, fontSize: number) {
  return normalizePdfText(text).length * fontSize * 0.52;
}

function truncateTextToFit(text: string, columnWidth: number, fontSize: number) {
  const safeText = normalizePdfText(text);
  const availableWidth = Math.max(columnWidth - CELL_PADDING_X * 2, 12);
  const maxChars = Math.max(1, Math.floor(availableWidth / (fontSize * 0.54)));

  if (safeText.length <= maxChars) return safeText;
  if (maxChars <= 3) return safeText.slice(0, maxChars);

  return `${safeText.slice(0, maxChars - 3)}...`;
}

function wrapTextToFit(
  text: string,
  columnWidth: number,
  fontSize: number,
  maxLines: number,
) {
  const safeText = normalizePdfText(text).trim();
  const availableWidth = Math.max(columnWidth - CELL_PADDING_X * 2, 12);
  const maxChars = Math.max(1, Math.floor(availableWidth / (fontSize * 0.54)));

  if (safeText.length <= maxChars) return [safeText];

  const words = safeText.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length <= maxChars) {
      currentLine = candidate;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    lines.push(truncateTextToFit(word, columnWidth, fontSize));
    currentLine = '';
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length <= maxLines) return lines;

  const visibleLines = lines.slice(0, maxLines);
  visibleLines[maxLines - 1] = truncateTextToFit(
    lines.slice(maxLines - 1).join(' '),
    columnWidth,
    fontSize,
  );

  return visibleLines;
}

function capitalizeLabel(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function formatSectionLabel(value: string) {
  return normalizePdfText(value).toUpperCase();
}

function normalizeScopeLabel(value: string) {
  return value.replace(/\s*\(\d+\)\s*$/, '').trim();
}

function sanitizeFileSegment(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizePdfText(value: string) {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .split('')
    .map((character) => (character.charCodeAt(0) <= 0xff ? character : '?'))
    .join('');
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function toPdfColorCommand(color: RgbColor, mode: 'fill' | 'stroke') {
  const operator = mode === 'fill' ? 'rg' : 'RG';

  return `${formatPdfNumber(color[0])} ${formatPdfNumber(color[1])} ${formatPdfNumber(color[2])} ${operator}`;
}

function formatPdfNumber(value: number) {
  return Number(value.toFixed(3)).toString();
}

function toPdfBytes(value: string) {
  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    bytes[index] = code <= 0xff ? code : 63;
  }

  return bytes;
}
