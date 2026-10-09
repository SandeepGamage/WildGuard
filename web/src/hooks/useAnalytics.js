import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exportReport, generateReport, getParks, getReport, getSavedReports } from '../api/analytics.api';
import { saveFile } from '../utils/download';

export const queryKeys = {
  parks: ['analytics', 'parks'],
  reports: ['analytics', 'reports'],
  report: (id) => ['analytics', 'report', id],
};

/** Parks and their sectors for the filter bar. They rarely change. */
export function useParks() {
  return useQuery({ queryKey: queryKeys.parks, queryFn: getParks, staleTime: 60 * 60 * 1000 });
}

/** Generate a report from the chosen filters; a new report also refreshes the saved list. */
export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateReport,
    onSuccess: (report) => {
      if (report?.empty) return;
      queryClient.setQueryData(queryKeys.report(report.id), report);
      queryClient.invalidateQueries({ queryKey: queryKeys.reports });
    },
  });
}

export function useSavedReports() {
  return useQuery({ queryKey: queryKeys.reports, queryFn: getSavedReports });
}

/** A saved report opened from the "Saved reports" page. */
export function useSavedReport(id) {
  return useQuery({ queryKey: queryKeys.report(id), queryFn: () => getReport(id), enabled: Boolean(id) });
}

/** Export a report and hand the file to the browser (UC4c). */
export function useExportReport() {
  return useMutation({
    mutationFn: async ({ reportId, format, sections }) => {
      const file = await exportReport(reportId, { format, sections });
      saveFile({ blob: file.blob, filename: file.filename ?? `wildguard-report.${format.toLowerCase()}` });
      return { format };
    },
  });
}
