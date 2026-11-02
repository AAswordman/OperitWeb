(function () {
  const e = React.createElement;
  const useEffect = React.useEffect;
  const useMemo = React.useMemo;
  const useState = React.useState;

  const TYPE_OPTIONS = [
    { value: "expense", label: "支出" },
    { value: "income", label: "收入" }
  ];

  const VIEW_OPTIONS = [
    { value: "all", label: "全部" },
    { value: "expense", label: "仅支出" },
    { value: "income", label: "仅收入" }
  ];

  function todayText() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatMoney(value) {
    const number = Number(value || 0);
    return number.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  async function requestJson(url, options) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json"
      },
      ...options
    });
    const data = await response.json();
    if (!response.ok || data?.success === false) {
      throw new Error(data?.message || "Request failed");
    }
    return data;
  }

  function createInitialForm() {
    return {
      id: "",
      type: "expense",
      title: "",
      amount: "",
      category: "",
      date: todayText(),
      note: ""
    };
  }

  function SummaryCard(props) {
    return e(
      "div",
      { className: "summary-card" },
      e("div", { className: "summary-label" }, props.label),
      e("div", { className: props.className || "summary-value" }, props.value)
    );
  }

  function Field(props) {
    return e(
      "label",
      { className: props.full ? "field-wrap full" : "field-wrap" },
      e("span", { className: "field-label" }, props.label),
      props.children
    );
  }

  function App() {
    const [entries, setEntries] = useState([]);
    const [summary, setSummary] = useState({
      count: 0,
      income: 0,
      expense: 0,
      balance: 0
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [query, setQuery] = useState("");
    const [view, setView] = useState("all");
    const [form, setForm] = useState(createInitialForm());

    const editing = Boolean(form.id);

    async function loadEntries() {
      setLoading(true);
      setError("");
      try {
        const result = await requestJson("/api/entries");
        setEntries(Array.isArray(result.entries) ? result.entries : []);
        setSummary(result.summary || {
          count: 0,
          income: 0,
          expense: 0,
          balance: 0
        });
      } catch (loadError) {
        setError(String(loadError.message || loadError));
      } finally {
        setLoading(false);
      }
    }

    useEffect(function () {
      loadEntries();
    }, []);

    const filteredEntries = useMemo(function () {
      const keyword = query.trim().toLowerCase();
      return entries.filter(function (entry) {
        if (view !== "all" && entry.type !== view) {
          return false;
        }
        if (!keyword) {
          return true;
        }
        const haystack = [
          entry.title,
          entry.category,
          entry.note,
          entry.date
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(keyword);
      });
    }, [entries, query, view]);

    function patchForm(key, value) {
      setForm(function (current) {
        return {
          ...current,
          [key]: value
        };
      });
    }

    function resetForm() {
      setForm(createInitialForm());
    }

    function startEdit(entry) {
      setForm({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        amount: String(entry.amount),
        category: entry.category || "",
        date: entry.date || todayText(),
        note: entry.note || ""
      });
      setSuccess("");
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function handleSubmit(event) {
      event.preventDefault();
      setSaving(true);
      setError("");
      setSuccess("");
      try {
        const payload = {
          type: form.type,
          title: form.title,
          amount: Number(form.amount),
          category: form.category,
          date: form.date,
          note: form.note
        };
        if (editing) {
          await requestJson("/api/entries/" + encodeURIComponent(form.id), {
            method: "PUT",
            body: JSON.stringify(payload)
          });
          setSuccess("账目已更新");
        } else {
          await requestJson("/api/entries", {
            method: "POST",
            body: JSON.stringify(payload)
          });
          setSuccess("账目已创建");
        }
        resetForm();
        await loadEntries();
      } catch (submitError) {
        setError(String(submitError.message || submitError));
      } finally {
        setSaving(false);
      }
    }

    async function handleDelete(entry) {
      const confirmed = window.confirm("确定删除这条账目吗？");
      if (!confirmed) {
        return;
      }
      setError("");
      setSuccess("");
      try {
        await requestJson("/api/entries/" + encodeURIComponent(entry.id), {
          method: "DELETE"
        });
        setSuccess("账目已删除");
        if (form.id === entry.id) {
          resetForm();
        }
        await loadEntries();
      } catch (deleteError) {
        setError(String(deleteError.message || deleteError));
      }
    }

    const hero = e(
      "section",
      { className: "hero" },
      e(
        "div",
        { className: "hero-card" },
        e("div", { className: "eyebrow" }, "Operit Sidebar ToolPkg"),
        e("h1", { className: "hero-title" }, "本地 React 记账本"),
        e(
          "p",
          { className: "hero-subtitle" },
          "这个页面运行在 ToolPkg 启动的本地网页服务里，数据写入 Android 存储，界面通过 WebView 打开。"
        ),
        e(
          "div",
          { className: "hero-actions" },
          e(
            "button",
            {
              className: "btn primary",
              type: "button",
              onClick: function () {
                resetForm();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            },
            "新建账目"
          ),
          e(
            "button",
            {
              className: "btn ghost",
              type: "button",
              onClick: loadEntries
            },
            "刷新列表"
          )
        )
      ),
      e(
        "div",
        { className: "hero-meta" },
        e(
          "div",
          { className: "meta-tile" },
          e("div", { className: "meta-label" }, "总账目"),
          e("div", { className: "meta-value" }, String(summary.count || 0))
        ),
        e(
          "div",
          { className: "meta-tile" },
          e("div", { className: "meta-label" }, "结余"),
          e("div", { className: "meta-value" }, "¥" + formatMoney(summary.balance))
        ),
        e(
          "div",
          { className: "meta-tile" },
          e("div", { className: "meta-label" }, "收入"),
          e("div", { className: "meta-value income" }, "¥" + formatMoney(summary.income))
        ),
        e(
          "div",
          { className: "meta-tile" },
          e("div", { className: "meta-label" }, "支出"),
          e("div", { className: "meta-value expense" }, "¥" + formatMoney(summary.expense))
        )
      )
    );

    const toolBar = e(
      "div",
      { className: "toolbar" },
      e(
        "div",
        { className: "search-row" },
        e("input", {
          className: "search-input",
          value: query,
          onChange: function (event) {
            setQuery(event.target.value);
          },
          placeholder: "搜索标题、分类、备注或日期"
        })
      ),
      e(
        "div",
        { className: "chip-row" },
        VIEW_OPTIONS.map(function (option) {
          return e(
            "button",
            {
              key: option.value,
              type: "button",
              className: "chip" + (view === option.value ? " active" : ""),
              onClick: function () {
                setView(option.value);
              }
            },
            option.label
          );
        })
      )
    );

    const banners = e(
      React.Fragment,
      null,
      error ? e("div", { className: "banner error" }, error) : null,
      success ? e("div", { className: "banner success" }, success) : null
    );

    const entryPanel = e(
      "section",
      { className: "panel" },
      e("h2", { className: "panel-title" }, "账目总览"),
      e(
        "div",
        { className: "summary-grid" },
        e(SummaryCard, {
          label: "当前筛选结果",
          value: String(filteredEntries.length)
        }),
        e(SummaryCard, {
          label: "总收入",
          value: "¥" + formatMoney(summary.income),
          className: "summary-value income"
        }),
        e(SummaryCard, {
          label: "总支出",
          value: "¥" + formatMoney(summary.expense),
          className: "summary-value expense"
        })
      ),
      toolBar,
      loading
        ? e(
            "div",
            { className: "loading" },
            e("div", { className: "spinner" }),
            e("span", null, "正在加载账目...")
          )
        : filteredEntries.length === 0
          ? e(
              "div",
              { className: "empty-card" },
              e("h3", null, "还没有匹配的账目"),
              e(
                "p",
                { className: "muted" },
                "你可以直接在右侧创建第一条记录，或者调整筛选条件。"
              )
            )
          : e(
              "div",
              { className: "entry-list" },
              filteredEntries.map(function (entry) {
                return e(
                  "article",
                  { key: entry.id, className: "entry-card" },
                  e(
                    "div",
                    { className: "entry-top" },
                    e(
                      "div",
                      null,
                      e("h3", { className: "entry-title" }, entry.title),
                      e(
                        "div",
                        { className: "entry-meta" },
                        entry.date + " · " + (entry.category || "未分类")
                      )
                    ),
                    e(
                      "div",
                      {
                        className:
                          "amount " + (entry.type === "income" ? "income" : "expense")
                      },
                      (entry.type === "income" ? "+" : "-") + "¥" + formatMoney(entry.amount)
                    )
                  ),
                  entry.note
                    ? e("div", { className: "entry-note" }, entry.note)
                    : null,
                  e(
                    "div",
                    { className: "tag-row" },
                    e(
                      "span",
                      { className: "tag" },
                      entry.type === "income" ? "收入" : "支出"
                    ),
                    entry.category
                      ? e("span", { className: "tag" }, entry.category)
                      : null
                  ),
                  e(
                    "div",
                    { className: "entry-actions" },
                    e(
                      "button",
                      {
                        className: "btn secondary",
                        type: "button",
                        onClick: function () {
                          startEdit(entry);
                        }
                      },
                      "编辑"
                    ),
                    e(
                      "button",
                      {
                        className: "btn danger",
                        type: "button",
                        onClick: function () {
                          handleDelete(entry);
                        }
                      },
                      "删除"
                    )
                  )
                );
              })
            )
    );

    const formPanel = e(
      "section",
      { className: "panel" },
      e("h2", { className: "panel-title" }, editing ? "编辑账目" : "新增账目"),
      e(
        "form",
        { onSubmit: handleSubmit },
        e(
          "div",
          { className: "form-grid" },
          e(
            Field,
            { label: "类型" },
            e(
              "select",
              {
                className: "field-select",
                value: form.type,
                onChange: function (event) {
                  patchForm("type", event.target.value);
                }
              },
              TYPE_OPTIONS.map(function (option) {
                return e(
                  "option",
                  { key: option.value, value: option.value },
                  option.label
                );
              })
            )
          ),
          e(
            Field,
            { label: "日期" },
            e("input", {
              className: "field",
              type: "date",
              value: form.date,
              onChange: function (event) {
                patchForm("date", event.target.value);
              }
            })
          ),
          e(
            Field,
            { label: "标题", full: true },
            e("input", {
              className: "field",
              value: form.title,
              onChange: function (event) {
                patchForm("title", event.target.value);
              },
              placeholder: "例如：午饭、工资、打车"
            })
          ),
          e(
            Field,
            { label: "金额" },
            e("input", {
              className: "field",
              type: "number",
              inputMode: "decimal",
              value: form.amount,
              onChange: function (event) {
                patchForm("amount", event.target.value);
              },
              placeholder: "0.00"
            })
          ),
          e(
            Field,
            { label: "分类" },
            e("input", {
              className: "field",
              value: form.category,
              onChange: function (event) {
                patchForm("category", event.target.value);
              },
              placeholder: "餐饮、交通、工资"
            })
          ),
          e(
            Field,
            { label: "备注", full: true },
            e("textarea", {
              className: "field-textarea",
              value: form.note,
              onChange: function (event) {
                patchForm("note", event.target.value);
              },
              placeholder: "可以补充发生场景、付款方式、对方信息等"
            })
          )
        ),
        e(
          "div",
          { className: "form-actions" },
          e(
            "button",
            {
              className: "btn primary",
              type: "submit",
              disabled: saving
            },
            saving ? "保存中..." : editing ? "保存修改" : "创建账目"
          ),
          e(
            "button",
            {
              className: "btn secondary",
              type: "button",
              onClick: resetForm,
              disabled: saving
            },
            editing ? "取消编辑" : "重置表单"
          )
        )
      )
    );

    return e(
      "main",
      { className: "page" },
      hero,
      banners,
      e(
        "div",
        { className: "layout" },
        entryPanel,
        formPanel
      )
    );
  }

  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(e(App));
})();
