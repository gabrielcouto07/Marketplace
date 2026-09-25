"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MessageCircleQuestion } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAskQuestion, useProductQuestions } from "@/features/catalog/api";
import { useIsAuthenticated } from "@/features/auth/store";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { questionSchema, type QuestionFormValues } from "@/lib/validation/schemas";

/** Card de perguntas e respostas: textarea + botão azul-suave e lista de Q&A. */
export function ProductQuestions({
  productId,
  productSlug,
  className,
}: {
  productId: string;
  productSlug: string;
  className?: string;
}) {
  const t = useTranslations("product");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const format = useFormatter();
  const isAuthenticated = useIsAuthenticated();
  const questions = useProductQuestions(productId);
  const ask = useAskQuestion(productId);
  const items = questions.data?.pages.flatMap((p) => p.items) ?? [];

  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: { question: "" },
  });
  const errorKey = form.formState.errors.question?.message;

  const onSubmit = form.handleSubmit((values) => {
    ask.mutate(
      { productId, question: values.question },
      {
        onSuccess: () => {
          form.reset();
          toast.success(t("questionSent"));
        },
        onError: (error) => {
          const msg = isApiError(error)
            ? (error.errors?.question?.[0] ?? error.message)
            : tc("loading");
          toast.error(msg);
        },
      },
    );
  });

  return (
    <section
      aria-labelledby="questions-title"
      className={cn("flex flex-col gap-4 rounded-3xl bg-card p-4.5 shadow-card", className)}
    >
      <h2 id="questions-title" className="text-base font-extrabold tracking-tight">
        {t("questionsTitle")}
      </h2>

      {isAuthenticated ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-2.5" noValidate>
          <label htmlFor="question" className="text-sm font-bold">
            {t("askQuestion")}
          </label>
          <Textarea
            id="question"
            rows={3}
            placeholder={t("questionPlaceholder")}
            aria-invalid={errorKey ? true : undefined}
            aria-describedby={errorKey ? "question-error" : undefined}
            className="min-h-20"
            {...form.register("question")}
          />
          {errorKey ? (
            <p id="question-error" className="text-xs font-medium text-destructive">
              {tv(errorKey as "questionMin" | "questionMax")}
            </p>
          ) : null}
          <Button type="submit" variant="soft" className="self-end" disabled={ask.isPending}>
            {ask.isPending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {t("sendQuestion")}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-300 p-4">
          <p className="text-sm text-muted-foreground">{t("askQuestion")}</p>
          <Button
            variant="soft"
            size="sm"
            render={<Link href={`/entrar?next=/produto/${productSlug}`} />}
          >
            {t("loginToAsk")}
          </Button>
        </div>
      )}

      {questions.isPending ? (
        <div className="flex flex-col gap-3.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 border-t border-border pt-3.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-14 w-full" />
            </div>
          ))}
        </div>
      ) : questions.isError ? (
        <ErrorState error={questions.error} compact onRetry={() => questions.refetch()} />
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 border-t border-border pt-3.5 text-sm text-muted-foreground">
          <MessageCircleQuestion className="size-4 shrink-0" aria-hidden /> {t("noQuestions")}
        </p>
      ) : (
        <ul className="flex flex-col">
          {items.map((q, i) => (
            <li
              key={q.id}
              className="flex animate-rise flex-col gap-1 border-t border-border pt-3.5 pb-3.5 last:pb-0"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <p className="text-[13.5px] font-bold">{q.question}</p>
              <p className="text-xs text-muted-foreground">
                {q.askedBy} · {format.dateTime(new Date(q.askedAt), "short")}
              </p>
              {q.answer ? (
                <div className="mt-1.5 rounded-lg bg-surface px-3 py-2.5">
                  <p className="text-xs font-bold text-primary">{t("sellerAnswer")}</p>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-body">{q.answer.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format.dateTime(new Date(q.answer.answeredAt), "short")}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-xs font-semibold text-warning">{t("awaitingAnswer")}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {questions.hasNextPage ? (
        <Button
          variant="soft"
          size="sm"
          onClick={() => questions.fetchNextPage()}
          disabled={questions.isFetchingNextPage}
          className="self-center"
        >
          {questions.isFetchingNextPage ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : null}
          {tc("loadMore")}
        </Button>
      ) : null}
    </section>
  );
}
