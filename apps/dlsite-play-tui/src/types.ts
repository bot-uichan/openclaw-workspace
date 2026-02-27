export type SearchResult = {
  title: string;
  url: string;
  creator?: string;
  thumbnail?: string;
};

export type OwnedWork = {
  id: string;
  title: string;
  detailUrl: string;
  downloadUrl?: string;
  playUrl?: string;
};

export type DownloadTask = {
  workId: string;
  title: string;
  status: "queued" | "downloading" | "done" | "failed";
  message?: string;
};
