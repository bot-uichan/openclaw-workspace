const fullWidthDigits = '０１２３４５６７８９';

export function normalizeText(input: string): string {
  let text = input.normalize('NFKC');

  for (let index = 0; index < fullWidthDigits.length; index += 1) {
    text = text.replaceAll(fullWidthDigits[index], String(index));
  }

  text = text
    .replaceAll('％', '%')
    .replaceAll('¥', '円')
    .replace(/[OoＯｏ](?=\d)/g, '0')
    .replace(/(?<=\d)[OoＯｏ]/g, '0')
    .replace(/[Il｜]/g, '1')
    .replace(/円\./g, '円')
    .replace(/\s+/g, ' ')
    .trim();

  text = text.replace(/半額/g, '50%');
  text = text.replace(/([1-9]|10)割引/g, (_, rawDigits: string) => `${Number(rawDigits) * 10}%`);
  text = text.replace(/([1-9]|10)割/g, (_, rawDigits: string) => `${Number(rawDigits) * 10}%`);
  text = text.replace(/([1-9]\d?|100)%\s*(OFF|off|オフ|引|引き)/g, '$1%');
  text = text.replace(/税込\s*/g, '');

  return text;
}
