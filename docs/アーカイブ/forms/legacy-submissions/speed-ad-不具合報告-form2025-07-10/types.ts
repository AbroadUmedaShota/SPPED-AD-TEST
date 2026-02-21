export enum ReportType {
  Simple = 'simple',
  Detailed = 'detailed',
}

export enum BugCategory {
  Display = 'display',
  Functionality = 'functionality',
  Data = 'data',
  Error = 'error',
  Other = 'other',
}

export enum Severity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export interface FormData {
  reportType: ReportType;
  reporterName: string;
  reporterEmail: string;
  reporterCompany: string;
  occurrenceDate: string;
  occurrenceTime: string;
  device: string;
  deviceName: string;
  deviceOther: string;
  os: string;
  osOther: string;
  browser: string;
  browserVersion: string;
  browserOther: string;
  speedAdEnvironment: string;
  speedAdEnvironmentOther: string;
  bugCategory: BugCategory | '';
  bugSummary: string;
  questionnaireId: string;
  reproductionSteps: string;
  screenshot: string;
  screenshotFilename: string;
  expectedBehavior: string;
  actualBehavior: string;
  hasErrorMessage: boolean;
  errorMessage: string;
  internalProjectId: string;
  affectedModule: string;
  affectedModuleOther: string;
  severity: Severity | '';
  internalNotes: string;
  assigneeSuggestion: string;
}

export type FormErrors = {
  [K in keyof FormData | 'form' | 'screenshot']?: string;
};