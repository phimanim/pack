import type { KeyboardEvent } from "react";
import { useState } from "react";
import { useFetcher } from "react-router";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "~/components/ui/combobox";
import type { VocabKind } from "~/db/schema";
import { slugifyTerm } from "~/lib/slug";

type Term = { id: string; label: string; creatable?: string };

export function VocabCombobox({
  kind,
  name,
  terms: initialTerms,
  defaultIds = [],
  placeholder,
  multiple = true,
}: {
  kind: VocabKind;
  name: string;
  terms: { id: string; label: string }[];
  defaultIds?: string[];
  placeholder: string;
  multiple?: boolean;
}) {
  const fetcher = useFetcher<{ error: string }>();
  const anchor = useComboboxAnchor();
  const [extra, setExtra] = useState<{ id: string; label: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    multiple ? defaultIds : defaultIds.slice(0, 1),
  );
  // A single-select shows the selected label in its input, including when a
  // default is preselected on first render.
  const [query, setQuery] = useState(() =>
    multiple
      ? ""
      : (initialTerms.find((term) => term.id === defaultIds[0])?.label ?? ""),
  );

  const terms = [
    ...initialTerms,
    ...extra.filter(
      (item) => !initialTerms.some((term) => term.id === item.id),
    ),
  ];
  const selectedTerms = terms.filter((term) => selectedIds.includes(term.id));
  const trimmed = query.trim();
  const exactExists = terms.some(
    (term) => term.label.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  const items: Term[] =
    trimmed !== "" && !exactExists
      ? [
          ...terms,
          {
            id: `create:${trimmed}`,
            label: `Create "${trimmed}"`,
            creatable: trimmed,
          },
        ]
      : terms;

  function applyIds(ids: string[]) {
    setSelectedIds(multiple ? ids : ids.slice(-1));
  }

  function createTerm(label: string) {
    const id = slugifyTerm(label);
    if (!id) return;
    const existing = terms.find((term) => term.id === id);
    if (existing) {
      applyIds(
        multiple
          ? selectedIds.includes(existing.id)
            ? selectedIds
            : [...selectedIds, existing.id]
          : [existing.id],
      );
      setQuery("");
      return;
    }
    setExtra((current) => [...current, { id, label }]);
    applyIds(multiple ? [...selectedIds, id] : [id]);
    setQuery("");
    fetcher.submit({ intent: "add_term", kind, label }, { method: "post" });
  }

  function handleValueChange(next: Term | Term[] | null) {
    const list = Array.isArray(next) ? next : next ? [next] : [];
    const created = list.find((item) => item.creatable)?.creatable;
    if (created) {
      createTerm(created);
      return;
    }
    applyIds(list.map((item) => item.id));
    setQuery("");
  }

  function preventFormSubmit(event: KeyboardEvent) {
    if (event.key === "Enter") event.preventDefault();
  }

  const list = (
    <>
      <ComboboxEmpty>No matches.</ComboboxEmpty>
      <ComboboxList>
        {(item: Term) => (
          <ComboboxItem key={item.id} value={item}>
            {item.label}
          </ComboboxItem>
        )}
      </ComboboxList>
    </>
  );

  const comboboxProps = {
    name,
    items,
    autoHighlight: true,
    inputValue: query,
    onInputValueChange: setQuery,
    itemToStringLabel: (item: Term) => item.creatable ?? item.label,
    itemToStringValue: (item: Term) => item.id,
    isItemEqualToValue: (left: Term, right: Term) => left.id === right.id,
  };

  return (
    <div>
      {multiple ? (
        <Combobox
          {...comboboxProps}
          multiple
          value={selectedTerms}
          onValueChange={(next) => handleValueChange(next)}
        >
          <ComboboxChips ref={anchor} className="mt-2 w-full">
            <ComboboxValue>
              {selectedTerms.map((term) => (
                <ComboboxChip key={term.id}>{term.label}</ComboboxChip>
              ))}
            </ComboboxValue>
            <ComboboxChipsInput
              placeholder={placeholder}
              aria-label={placeholder}
              onKeyDown={preventFormSubmit}
            />
          </ComboboxChips>
          <ComboboxContent anchor={anchor}>{list}</ComboboxContent>
        </Combobox>
      ) : (
        <Combobox
          {...comboboxProps}
          value={selectedTerms[0] ?? null}
          onValueChange={(next) => handleValueChange(next)}
        >
          <ComboboxInput
            className="mt-2 w-full"
            placeholder={placeholder}
            aria-label={placeholder}
            onKeyDown={preventFormSubmit}
          />
          <ComboboxContent>{list}</ComboboxContent>
        </Combobox>
      )}
      {fetcher.data?.error ? (
        <p className="mt-1 text-sm">{fetcher.data.error}</p>
      ) : null}
    </div>
  );
}
