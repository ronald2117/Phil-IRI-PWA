export interface Passage {
  id: string;
  title: string;
  description: string;
  text: string;
}

export const PASSAGES: Passage[] = [
  {
    id: "si-paruparo-at-alitaptap",
    title: "Si Paruparo at Alitaptap",
    description: "Maikling kuwento tungkol sa kay paruparo at alitaptap.",
    text: `Malungkot si Alitaptap. Tatlong araw na siyang hindi kumakain. Masakit na ang kanyang tiyan. Kahit malakas ang ulan, hinanap niya ang kaibigang si Paruparo. Hihingi siya ng tulong dito. Nabigla si Paruparo nang makita si Alitaptap. Basa at nanghihina ito.
Dali-dali niya itong pinatuloy at pinakain. Niyakap niya ito pagkatapos. Mahal
niya ang kaibigang si Alitaptap.

"Dalhin mo itong pagkain. Sa susunod, mag-imbak ka ng pagkain.
Sumama man ang panahon, di ka magugutom," payo ni Paruparo.

"Tatandaan ko, kaibigan. Salamat muli," nakangiting wika ni Alitaptap.
Masaya itong lumipad pauwi.`,
  },
  {
    id: "ang-pagong-at-kuneho",
    title: "Ang Pagong at Kuneho",
    description: "Isang bagong salaysay tungkol sa tiyaga at tiwala sa sarili.",
    text: "Isang umaga, nagyabang ang Kuneho na siya ang pinakamabilis sa gubat. Hinamon siya ng Pagong sa isang paligsahan. Mabilis na tumakbo ang Kuneho at nagpahinga sa ilalim ng puno. Dahan-dahang nagpatuloy ang Pagong. Nang magising ang Kuneho, naroon na sa dulo ang Pagong. Natutuhan ng Kuneho na mahalaga ang tiyaga.",
  },
];

export function getPassage(passageId: string): Passage | undefined {
  return PASSAGES.find((passage) => passage.id === passageId);
}