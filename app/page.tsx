// 홈 (설계 문서 4.1). 분석 연결은 1-1 계획의 8번 작업에서 한다.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-16 pb-8">
      <h1 className="text-2xl font-bold leading-snug">
        마음에 든 장소,
        <br />
        바로 확인해 보세요
      </h1>
      <p className="mt-2 text-sm text-muted">
        인스타그램 게시물이나 릴스 링크를 붙여넣으면 장소와 추천 정보를 모아드려요.
      </p>

      <form className="mt-8 flex flex-col gap-3">
        <label htmlFor="url" className="sr-only">
          인스타그램 링크
        </label>
        <input
          id="url"
          name="url"
          type="url"
          inputMode="url"
          placeholder="https://www.instagram.com/reel/..."
          className="h-12 rounded-xl border border-line bg-transparent px-4 text-base outline-none focus:border-foreground"
        />
        <button
          type="submit"
          disabled
          className="h-12 rounded-xl bg-foreground text-base font-semibold text-background disabled:opacity-40"
        >
          장소 찾기
        </button>
      </form>
    </main>
  );
}
