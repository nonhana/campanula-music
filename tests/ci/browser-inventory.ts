import type { JSONReportSuite } from '@playwright/test/reporter';

export const browserCases = (suites: JSONReportSuite[]) =>
  suites.flatMap(function collect(suite): {
    id: string;
    file: string;
    name: string;
    project: string;
    status: string;
  }[] {
    return [
      ...suite.specs.flatMap((spec) =>
        spec.tests.map((test) => ({
          id: JSON.stringify([spec.id, test.projectName]),
          file: spec.file,
          name: spec.title,
          project: test.projectName,
          status: test.status,
        })),
      ),
      ...(suite.suites ?? []).flatMap(collect),
    ];
  });
