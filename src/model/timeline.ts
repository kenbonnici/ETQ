export interface Timeline {
  yearIndices: number[];
  years: number[];
  ages: number[];
}

export function buildTimeline(ageNow: number, endAge: number, nowDate: Date = new Date()): Timeline {
  const startAge = ageNow + 1;
  const maxAge = Math.max(startAge, endAge);
  const startYear = nowDate.getFullYear() + 1;

  const ages: number[] = [];
  const years: number[] = [];
  const yearIndices: number[] = [];

  for (let age = startAge, i = 0; age <= maxAge; age += 1, i += 1) {
    ages.push(age);
    years.push(startYear + i);
    yearIndices.push(i);
  }

  return { yearIndices, years, ages };
}
