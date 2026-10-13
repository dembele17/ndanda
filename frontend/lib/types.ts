export type Profile = {
  id: string;
  family_id: string;
  name: string;
  color: string;
  avatar: string;
  created_at: string;
};

export type Schedule = {
  id: string;
  family_id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  purpose: string;
  memo: string;
  /** Auth identity for write access only; user_id always means the car's user. */
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ScheduleInput = Pick<Schedule, "user_id" | "date" | "start_time" | "end_time" | "purpose" | "memo">;
export type FieldErrors = Partial<Record<keyof ScheduleInput, string>>;
export type ActionResult = {
  success?: boolean;
  error?: string;
  fieldErrors?: FieldErrors;
  conflicts?: Schedule[];
};
