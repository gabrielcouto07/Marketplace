"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Clock, MessageCircleQuestion } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAskQuestion, useProductQuestions } from "@/features/catalog/api";
import { useIsAuthenticated } from "@/features/auth/store";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { questionSchema, type QuestionFormValues } from "@/lib/validation/schemas";

/**
 * Perguntas e respostas: textarea + botão primary para quem está logado (ou aviso com botão
 * secondary "Entre para perguntar") e lista `divide-y` de perguntas com a resposta da loja.
 */
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
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs",
        className,
      )}
    >
      <h2 id="questions-title" className="text-title-3 text-foreground">
        {t("questionsTitle")}
      </h2>

      {isAuthenticated ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
          <Label htmlFor="question">{t("askQuestion")}</Label>
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
            <p id="question-error" className="flex items-center gap-1 text-caption text-danger">
              <AlertCircle className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              {tv(errorKey as "questionMin" | "questionMax")}
            </p>
          ) : null}
          <Button type="submit" variant="primary" className="self-end" loading={ask.isPending}>
            {t("sendQuestion")}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-md bg-surface-muted p-4">
          <p className="text-body-sm text-foreground-secondary">{t("askQuestion")}</p>
          <Button
            variant="secondary"
            size="sm"
            render={<Link href={`/entrar?next=/produto/${productSlug}`} />}
          >
            {t("loginToAsk")}
          </Button>
        </div>
      )}

      {questions.isPending ? (
        <ul className="flex flex-col divide-y divide-border">
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i} className="flex flex-col gap-2 py-4 last:pb-0">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-14 w-full" />
            </li>
          ))}
        </ul>
      ) : questions.isError ? (
        <ErrorState error={questions.error} compact onRetry={() => questions.refetch()} />
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 border-t border-border pt-4 text-body-sm text-foreground-secondary">
          <MessageCircleQuestion className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("noQuestions")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((q) => (
            <li key={q.id} className="flex flex-col gap-1 py-4 last:pb-0">
              <p className="text-body-sm font-medium text-foreground">{q.question}</p>
              <p className="text-caption text-foreground-muted">
                {q.askedBy} · {format.dateTime(new Date(q.askedAt), "short")}
              </p>
              {q.answer ? (
                <div className="mt-2 flex flex-col gap-1 border-l-2 border-primary pl-3">
                  <p className="text-caption text-primary">{t("sellerAnswer")}</p>
                  <p className="text-body-sm leading-relaxed text-foreground-secondary">
                    {q.answer.text}
                  </p>
                  <p className="text-caption text-foreground-muted">
                    {format.dateTime(new Date(q.answer.answeredAt), "short")}
                  </p>
                </div>
              ) : (
                <p className="mt-1 flex items-center gap-1 text-caption text-warning">
                  <Clock className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {t("awaitingAnswer")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {questions.hasNextPage ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => questions.fetchNextPage()}
          loading={questions.isFetchingNextPage}
          className="self-center"
        >
          {tc("loadMore")}
        </Button>
      ) : null}
    </section>
  );
}
