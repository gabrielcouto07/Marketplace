"use client";

import type { SellerQuestionDto } from "@marketplace/contracts";
import { CheckCircle2, ExternalLink, MessageCircle } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { FilterSelect, PanelCard, PanelToolbar } from "@/components/shared/panel-widgets";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";
import { BLUR_DATA_URL, isDirectImage } from "@/lib/images";

import { useAnswerQuestion, useSellerQuestions } from "../api";

type QuestionFilter = "unanswered" | "all";

const MAX_ANSWER = 1000;

/** Perguntas feitas pelos compradores nos produtos da loja; sem resposta primeiro. */
export function SellerQuestions() {
  const t = useTranslations("sellerPanel");
  const [filter, setFilter] = useState<QuestionFilter>("unanswered");
  const questions = useSellerQuestions({
    unanswered: filter === "unanswered" ? true : undefined,
    pageSize: 50,
  });

  return (
    <div>
      <PanelTitle>{t("questions")}</PanelTitle>
      <PanelToolbar>
        <FilterSelect
          id="seller-questions-filter"
          label={t("filterStatus")}
          value={filter}
          onChange={setFilter}
          items={{ unanswered: t("filterUnanswered"), all: t("filterAllStatus") }}
          className="sm:w-64"
        />
      </PanelToolbar>

      {questions.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : questions.isError ? (
        <ErrorState error={questions.error} onRetry={() => questions.refetch()} />
      ) : questions.data.items.length === 0 ? (
        <EmptyState
          illustration="check"
          title={filter === "unanswered" ? t("questionsEmptyTitle") : t("emptyTitle")}
          description={
            filter === "unanswered" ? t("questionsEmptyDescription") : t("questionsNoneYet")
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {questions.data.items.map((q) => (
            <li key={q.id}>
              <QuestionCard question={q} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionCard({ question }: { question: SellerQuestionDto }) {
  const t = useTranslations("sellerPanel");
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const answer = useAnswerQuestion();
  const [editing, setEditing] = useState(!question.answer);
  const [text, setText] = useState(question.answer?.text ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setError(t("answerRequired"));
      return;
    }
    setError(null);
    answer.mutate(
      { id: question.id, body: { text: trimmed } },
      {
        onSuccess: () => {
          toast.success(t("answerSaved"));
          setEditing(false);
        },
        onError: (e) => {
          if (isApiError(e) && e.errors?.text?.[0]) setError(e.errors.text[0]);
          else toast.error(isApiError(e) ? e.message : tErrors("genericTitle"));
        },
      },
    );
  };

  return (
    <PanelCard className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
          <Image
            src={question.productThumbnailUrl}
            alt=""
            fill
            sizes="56px"
            className="object-contain"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            unoptimized={isDirectImage(question.productThumbnailUrl)}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/produto/${question.productSlug}`}
              target="_blank"
              className="truncate text-body-sm font-semibold text-primary hover:underline"
            >
              {question.productName}
              <ExternalLink className="ml-1 inline size-3.5 align-text-top" strokeWidth={1.75} aria-hidden />
            </Link>
            {question.answer ? (
              <Badge variant="success">
                <CheckCircle2 className="size-3" strokeWidth={2} aria-hidden /> {t("answered")}
              </Badge>
            ) : (
              <Badge variant="warning">
                <MessageCircle className="size-3" strokeWidth={2} aria-hidden /> {t("awaitingAnswer")}
              </Badge>
            )}
          </div>
          <p className="text-body text-foreground">{question.question}</p>
          <p className="text-caption text-foreground-secondary">
            {t("askedBy", {
              name: question.askedBy,
              date: format.dateTime(new Date(question.askedAt), "short"),
            })}
          </p>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`answer-${question.id}`} className="sr-only">
            {t("answer")}
          </label>
          <Textarea
            id={`answer-${question.id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("answerPlaceholder")}
            rows={3}
            maxLength={MAX_ANSWER}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `answer-${question.id}-error` : undefined}
          />
          <div className="flex items-center justify-between gap-3">
            {error ? (
              <p id={`answer-${question.id}-error`} role="alert" className="text-caption text-danger">
                {error}
              </p>
            ) : (
              <span className="text-caption text-foreground-muted tabular-nums">
                {text.length}/{MAX_ANSWER}
              </span>
            )}
            <div className="flex gap-2">
              {question.answer ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setText(question.answer?.text ?? "");
                    setError(null);
                  }}
                >
                  {t("answerCancel")}
                </Button>
              ) : null}
              <Button variant="primary" size="sm" loading={answer.isPending} onClick={submit}>
                {t("answerSend")}
              </Button>
            </div>
          </div>
        </div>
      ) : question.answer ? (
        <div className="flex flex-col gap-2 rounded-md bg-surface-muted p-3">
          <p className="text-body-sm text-foreground">{question.answer.text}</p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-caption text-foreground-secondary">
              {t("answeredOn", {
                date: format.dateTime(new Date(question.answer.answeredAt), "short"),
              })}
            </span>
            <Button variant="link" size="sm" onClick={() => setEditing(true)}>
              {t("answerEdit")}
            </Button>
          </div>
        </div>
      ) : null}
    </PanelCard>
  );
}
