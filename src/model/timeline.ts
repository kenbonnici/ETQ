export interface Timeline {
  yearIndices: number[];
  years: number[];
  ages: number[];
}

export function buildTimeline(ageNow: number, endAge: number, currentYear: number = new Date().getFullYear()): Timeline {
  const startAge = ageNow;
  const periods = Math.max(1, endAge - ageNow);
  const startYear = currentYear;

  const ages: number[] = [];
  const years: number[] = [];
  const yearIndices: number[] = [];

  for (let i = 0; i < periods; i += 1) {
    ages.push(startAge + i);
    years.push(startYear + i);
    yearIndices.push(i);
  }

  return { yearIndices, years, ages };
}
