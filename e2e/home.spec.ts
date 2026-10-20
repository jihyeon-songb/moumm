import { expect, test } from "@playwright/test";

test("홈에서 링크 입력창과 장소 찾기 버튼을 보여준다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /바로 확인해 보세요/ })).toBeVisible();
  await expect(page.getByLabel("인스타그램 링크")).toBeVisible();
  await expect(page.getByRole("button", { name: "장소 찾기" })).toBeVisible();
});
