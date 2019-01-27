import axios from "axios";
import { JSDOM } from "jsdom";
import * as moment from "moment";

export interface WeirdBlogArticle {
  id: number;
  category: string;
  tags: string[];
  publishedAt: Date;
  title: string;
  author: string;
  content: string; // html
}

export class WeirdBlog {
  public static async exists(postId: number): Promise<boolean> {
    const res = await axios({
      method: "HEAD",
      url: `http://blog.weirdx.io/post/${postId}`,
      validateStatus(status) {
        return status === 200 || status === 404;
      }
    });

    return res.status === 200;
  }

  public static async read(postId: number): Promise<WeirdBlogArticle> {
    const res = await axios({
      method: "GET",
      url: `http://blog.weirdx.io/post/${postId}`,
    });

    const dom = new JSDOM(res.data);
    const doc = dom.window.document;
    const { head, body } = doc;

    const category = (() => {
      const og = head.querySelector("meta[property='article:section']");
      if (og) {
        return og.getAttribute("content")!.trim();
      }

      return body.querySelector(".category")!.textContent!.trim();
    })();

    const tags = (() => {
      const og = head.querySelectorAll("meta[property='article:tag']");
      if (og.length > 0) {
        return Array.from(og)
          .map((el) => el.getAttribute("content")!.trim());
      }

      return Array.from(body.querySelectorAll(".tags [rel='tag']"))
        .map((el) => el.textContent!.trim());
    })();

    const publishedAt = (() => {
      const og = head.querySelector("meta[property='article:published_time']");

      if (og) {
        return moment(og.getAttribute("content")!.trim()).toDate();
      }

      return moment(body.querySelector(".date")!.textContent!.trim(), "MMMM D, YYYY").toDate();
    })();

    const title = doc.title.trim();
    const author = body.querySelector(".author [rel='author']")!.textContent!.trim();
    const content = (() => {
      const articleEl = body.querySelector("article.post")!;

      // Remove unnecessary parts
      Array.from(articleEl.querySelectorAll([
        ".entry-content > .sharedaddy",
        ".entry-content > .yarpp-related",
        ".entry-content > .tags",
      ].join(", "))).forEach((el) => el.remove());

      // Replace code blocks
      const codeBlocks = articleEl.querySelectorAll("code");

      if (codeBlocks.length >= 0) {
        const entry = articleEl.querySelector(".entry-content")!;
        const notice = doc.createElement("p");
        notice.innerText = "이 포스트는 코드 스니펫을 포함하고 있습니다. 코드 스니펫을 확인하시려면 브라우저를 사용해주세요.";
        entry.appendChild(notice);

        Array.from(codeBlocks).forEach((el) => {
          const target = el.parentElement!.tagName === "pre" ?
            el.parentElement! :
            el;

          const text = doc.createElement("p");
          text.innerText = "코드 스니펫";
          target.parentElement!.replaceChild(target, text);
        });
      }

      return articleEl.innerHTML!;
    })();

    return {
      id: postId,
      category,
      tags,
      publishedAt,
      title,
      author,
      content,
    };
  }
}
