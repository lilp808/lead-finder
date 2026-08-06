import { assignAgentTeam } from '../src/lib/agent-team.js';

const cases = [
  { province: 'Samut Prakan', expect: 'A' },
  { province: 'Chachoengsao', expect: 'A' },
  { province: 'samut sakhon', expect: 'A' },
  { province: 'Chonburi', expect: 'B' },
  { province: 'Rayong', expect: 'B' },
  { province: 'Ayutthaya', expect: 'C' },
  { province: 'Pathum Thani', expect: 'C' },
  { province: 'Nonthaburi', expect: 'C' },
  { province: 'Nakhon Pathom', expect: 'C' },
  { province: 'Bangkok', district: 'Bang Na', expect: 'A' },
  { province: 'Bangkok', district: 'Lat Krabang', expect: 'A' },
  { province: 'Bangkok', district: 'Chatuchak', expect: 'C' },
  { province: 'Bangkok', district: 'Lak Si', expect: 'C' },
  { province: 'Bangkok', district: 'Pathum Wan', expect: null },
  { province: 'กรุงเทพมหานคร', district: 'สวนหลวง', expect: 'A' },
  { province: 'กรุงเทพมหานคร', district: 'สายไหม', expect: 'C' },
  { province: 'Unknown', expect: null },
  { province: '', expect: null },
  { province: 'Bangkok', district: 'Bang Na', sub_district: 'Bang Na', expect: 'A' },
];

let fail = 0;
for (const c of cases) {
  const got = assignAgentTeam(c);
  const ok = got === c.expect;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(c)} => ${got} (expect ${c.expect})`);
}
console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
