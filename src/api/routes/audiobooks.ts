import { SQS } from "aws-sdk";
import * as Joi from "joi";
import { Namespace, PresenterRouteFactory, StandardError } from "vingle-corgi";

import { AudioBook } from "../../models";
import { WeirdBlog } from "../../services/weird-blog";
import * as Presenters from "../presenters";

const sqs = new SQS();

export const route =
  new Namespace("/audiobooks", {
    params: {
      id: Joi.number().integer().positive().required(),
    },

    children: [
      PresenterRouteFactory.GET("/:id", {
        desc: "Get audiobook of given post id",
        operationId: "getAudiobook",
      }, {}, Presenters.AudioBookItem, async function() {
        const id = this.params.id as number;

        let book = await AudioBook.primaryKey.get(id);
        if (book) {
          return book;
        }

        if (!(await WeirdBlog.exists(id))) {
          throw new StandardError(404, {
            code: "ARTICLE_NOT_EXIST",
            message: "The requested article was not found on blog.weirdx.io",
          });
        }

        book = AudioBook.create(id);
        await book.save();

        await sqs.sendMessage({
          QueueUrl: process.env.AUDIOBOOK_TASK_QUEUE_URL!,
          MessageBody: JSON.stringify({ id: book.id }),
        }).promise();

        return book;
      }),
    ],
  });
