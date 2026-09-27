// Local demo only: the accounts the demo gateway accepts. Seeded into auth.users by start.sh.
export const DEMO_PASSWORD = "Demo1234!";

export const accounts = [
  { id: "00000000-0000-4000-8000-00000000a001", email: "admin@eduprep.africa", name: "Demo Admin", role: "admin" },
  { id: "00000000-0000-4000-8000-00000000a002", email: "reviewer@eduprep.africa", name: "Demo Reviewer", role: "reviewer" },
  { id: "00000000-0000-4000-8000-00000000a003", email: "teacher@eduprep.africa", name: "Demo Teacher", role: "teacher" },
  // A learner for trying the chat from the student side (mobile app pointed at the local backend).
  { id: "00000000-0000-4000-8000-00000000b001", email: "student@eduprep.africa", name: "Demo Student", role: "student", track: ["cm-bac", "serie-d"] },
];

export function accountsSql() {
  return accounts
    .map((a) => {
      const lines = [
        `insert into auth.users (id, email, raw_user_meta_data) values ('${a.id}', '${a.email}', '{"display_name":"${a.name}"}') on conflict (id) do nothing;`,
        `update public.profiles set role = '${a.role}', display_name = '${a.name}' where id = '${a.id}';`,
      ];
      if (a.track) {
        lines.push(
          `update public.profiles p set target_exam_id = t.exam_id, target_track_id = t.id, onboarding_completed = true ` +
            `from public.exam_tracks t join public.exams e on e.id = t.exam_id ` +
            `where p.id = '${a.id}' and e.slug = '${a.track[0]}' and t.slug = '${a.track[1]}';`,
        );
      }
      return lines.join("\n");
    })
    .join("\n");
}

if (process.argv[2] === "sql") console.log(accountsSql());
