import {
  AudioBook,
} from "../index";

beforeEach(async () => {
  await AudioBook.createTable();
});

afterEach(async () => {
  await AudioBook.dropTable();
});
