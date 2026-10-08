import { Camera, LayoutGrid, Table2, BookUser, Users } from 'lucide-react';

// Ontario Kindergarten Program frames. Each frame lists the overall
// expectations teachers pick from when tagging an observation -- edit these
// lists freely; observations store the text, so changing a label later won't
// break older observations.
export const FRAMES = [
  {
    key: 'BC',
    label: 'Belonging and Contributing',
    short: 'Belonging',
    color: 'bg-sky-100 text-sky-800 border-sky-300',
    dot: 'bg-sky-500',
    expectations: ['1. Communicate with others', '3. Identify personal strategies', '4. Positive self-image', '22. Communicate thoughts/feelings', '25. Sense of belonging'],
  },
  {
    key: 'SRWB',
    label: 'Self-Regulation and Well-Being',
    short: 'Self-Reg',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dot: 'bg-emerald-500',
    expectations: ['2. Demonstrate independence', '6. Awareness of thoughts', '7. Natural elements role', '8. Recognize strengths', '31. Strategies for self-regulation'],
  },
  {
    key: 'DLMB',
    label: 'Demonstrating Literacy and Mathematics Behaviours',
    short: 'Literacy & Math',
    color: 'bg-amber-100 text-amber-800 border-amber-300',
    dot: 'bg-amber-500',
    expectations: ['11. Appreciate creative work', '15. Awareness of print', '17. Daily math use', '20. Math words/symbols', '21. Response to text'],
  },
  {
    key: 'PSI',
    label: 'Problem Solving and Innovating',
    short: 'Problem Solving',
    color: 'bg-violet-100 text-violet-800 border-violet-300',
    dot: 'bg-violet-500',
    expectations: ['13. Problem solving strategies', '14. Document learning', '23. Design/build structures', '24. Inquiry sequence skills', '29. Predictions/observations'],
  },
];

export const FRAME_BY_KEY = Object.fromEntries(FRAMES.map((f) => [f.key, f]));

// A child counts as "due" for an observation after this many days without one.
export const STALE_DAYS = 14;

export const ROLE_META = {
  owner: { label: 'Owner', hint: 'You created this class' },
  editor: { label: 'Editor', hint: 'Can add observations and edit the roster' },
  viewer: { label: 'Viewer', hint: 'Can view observations and portfolios only' },
};

export const NAV_ITEMS = [
  { id: 'capture', label: 'Capture', icon: Camera, editOnly: true },
  { id: 'observations', label: 'Observations', icon: LayoutGrid },
  { id: 'coverage', label: 'Coverage', icon: Table2 },
  { id: 'portfolio', label: 'Portfolio', icon: BookUser },
  { id: 'roster', label: 'Roster', icon: Users },
];
