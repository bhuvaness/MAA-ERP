# PayanarssType Script — Keyword Additions

76 new nodes: 70 language keywords + a 6-node sample program.
Files: `PTS_ScriptKeywords.json` (new nodes only) · `VanakkamPayanarssTypes_with_ScriptKeywords.json` (merged, 14,429 nodes).

## How a PTS program is structured

A PTS program is a tree, not text. Three rules cover the whole language:

1. **Declaration is by node type.** A child of a `Program` node typed `Number` is a variable. A child typed `FunctionType` is a function. There is no `var` or `function` keyword because the tree already says it.
2. **Logic is an expression tree in `Attributes`.** Each element is `{ "Id": <operator | keyword | function | variable>, "Attributes": [operands] }`.
3. **Constants are `Literal` nodes.** `{ "Id": Literal, "Value": 100, "ValueTypeId": Number }`.

### Statement shapes (convention used by the sample)

| Keyword | Attributes shape |
|---|---|
| `if` | `[condition, block, else?]` |
| `else` | `[block]` (or `[if ...]` for else-if) |
| `while` | `[condition, block]` |
| `do` | `[block, condition]` |
| `for` | `[init, condition, step, block]` |
| `foreach` | `[loopVariable, in, block]` → `in` holds `[collection]` |
| `try` | `[block, catch?, finally?]` |
| `catch` | `[block]` (optionally a variable to bind the Exception) |
| `block` | `[stmt1, stmt2, ...]` executed in order |
| `=` | `[target, value]` |
| function call | `{ "Id": <FunctionType or built-in>, "Attributes": [args] }` |

## 1. Control flow — `01` range, parent `AttributeType`

| Id (suffix) | Keyword | Note |
|---|---|---|
| …0010000000000009 | `while` | **Fills a dangling ID** referenced by `for` |
| …0010000000000010 | `do` | **Fills a dangling ID** referenced by `for` |
| …0010000000000012 | `in` | **Fills a dangling ID** referenced by `foreach` |
| …0010000000000013 | `try` | Parent of `catch` / `finally` (mirrors `switch` → `case`) |
| …0010000000000014 | `catch` | Child of `try` |
| …0010000000000018 | `Exception` | **Fills a dangling ID** referenced by `throw` |
| …0010000000000019 | `finally` | Child of `try` |
| …0010000000000020 | `await` | For `ASKAGENT` and other async calls |
| …0010000000000021 | `block` | Ordered statement list |

## 2. Declarations & literals — `06` range, parent `AttributeType`

| Keyword | Use |
|---|---|
| `param` | Put in a variable's `Attributes` → input parameter |
| `out` | Put in a variable's `Attributes` → returned to caller |
| `Literal` | Inline constant in an expression |
| `null` | Null value |
| `import` | Reference another Program's functions |
| `this` | Current record inside an event handler (`this.CreditLimit`) |

For constants use the existing `ReadOnly` flag — no separate `const` added.

## 3. Operators — `03` range, typed `OperatorType`

| Group | Operators |
|---|---|
| ArithmeticOperator (existing) | `^` added |
| AssignmentOperator | `+=` `-=` `*=` `/=` `%=` |
| UnaryOperator | `++` `--` |
| StringOperator | `&` |
| NullOperator | `??` `?.` |
| ConditionalOperator | `?:` |
| TypeOperator | `is` `as` |
| AccessOperator | `.` `[]` |

## 4. Events — `07` range, new `EventType` root

`OnLoad` · `OnChange` · `OnBeforeDelete` · `OnAfterDelete` · `OnApprove` · `OnReject` · `OnSchedule` · `OnAgentMessage`

The existing `OnBeforeSave` / `OnAfterSave` are unchanged. A function becomes an event handler by listing the event node in its `Attributes`. `OnAgentMessage` is the receiving side of the existing `SendMessageToAgent`.

## 5. Data types — `08` range, self-rooted like `Number`

`List` · `Map` · `Void` · `Any`

## 6. Built-in functions — new categories under `BuiltInFunctionType`

**CollectionFunction (cat 9):** `APPEND` `REMOVE` `CONTAINS` `SIZE` `GET` `SET` `KEYS` `FIRST` `LAST` `ISEMPTY`

**SystemFunction (cat 10):** `CURRENTUSER` `CURRENTTENANT` `NEWID` `NEXTSEQUENCE` `LOG` `NOTIFY` `ASKAGENT`

`NEXTSEQUENCE` is the function that every `AUTO-NUMBER` rule in the taxonomy (e.g. `BKG-YYYYMMDD-NNNN`) needs at runtime.

## Sample program

Added under `SamplePrograms` → **Business Rules (param, this, try/catch, throw)**. Inputs `BookingAmount`, `CreditLimit`, `OutstandingBalance` are marked `param`; `IsApproved` is marked `out`. The function `OnBeforeSave_CreditCheck` decodes to:

```
OnBeforeSave
try
  block
    if
      >  ( OutstandingBalance + BookingAmount , CreditLimit )
      block
        IsApproved = false
        throw Exception("CREDIT_LIMIT", "Booking exceeds customer credit limit")
      else
        block
          IsApproved = true
  catch
    block
      LOG("WARN", "Credit check blocked booking")
      throw Exception
```

## Existing issues found (not modified)

1. **`for` references `while` and `do`.** Those IDs were missing and are now filled, but a `for` loop's slots should be init/condition/step, not other loop keywords. Review the `for` node's `Attributes`.
2. **`=` is under `ArithmeticOperator`.** It is assignment. Consider moving it into the new `AssignmentOperator` group.
3. **The `Compare Two Numbers` sample is malformed.** It encodes `IF → A → > → B`. The correct tree is `IF → [ > → [A, B], trueValue, falseValue ]`.
4. **`AttributeType`, `ReadOnly`, `Mandatory` have `Attributes: [1e+32]`.** An ID was stored as a JSON number and lost precision. It should be the string `"100000000000000000000000000000000"`.
5. **The `Quotient` sample is typed `LogicalFunction`** while `Sum`/`Difference`/`Product` are `FunctionType`.
