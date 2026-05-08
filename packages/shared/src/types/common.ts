/**
 * Platform-agnostic Timestamp type.
 * On Firestore client: firebase Timestamp
 * On Cloud Functions: admin.firestore.Timestamp
 * In tests/mocks: { seconds: number; nanoseconds: number }
 */
export interface Timestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}
