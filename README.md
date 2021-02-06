# Mych's Macro Magic

A simple, sane, and friendly little scripting language for your Roll20 macros.

- Tired of writing macros that look like the cat had an uneasy dream (again!) on your keyboard?
- Stockholm syndrome just not working for you to keep you enchanted with that soup of brackets, braces, and strings of seemingly random dice-roll suffixes you wrote yesterday?
- Your [sense of pride and accomplishment](https://www.reddit.com/r/MuseumOfReddit/comments/8ish3t/the_time_that_ea_got_a_sense_of_pride_and/) not kicking in anymore like it used to after spending hours of figuring out how to bully the dice engine into comparing two numbers?

And that distant, lingering, but unmistakable yearning, like an unscratchable itch at the back of your mind, calling softly at you as if from afar: "How easy would this be if I could just use a proper *conditional* here?", and: "How nice if I didn't have to put all this stuff into *one* line?", and: "If I could just use *one tiny* variable here, that would be so handy..."

If that sounds familiar, then **Mych's Macro Magic (MMM)** is here for you. Just install it as an API script and start writing macro scripts like a boring, *productive* programmer would.

You're here to yell at dice, not at macros, after all – right?


### Contents

- [Scripts](#scripts) – [script commands](#mmm-script--end-script)
- [Expressions](#expressions) – [literals](#literals), [variables](#variables), [attributes](#attributes), [operators](#operators), [functions](#functions)
- [Recipes](#recipes)
- [Frequently Asked Questions](#frequently-asked-questions)
- [What's new?](#versions)
- [Copyright & License](#copyright--license)


## Scripts

You can write MMM scripts wherever you can write macro code: in the *Macros* tab in the sidebar, in your character sheet's *Abilities* tab, or even directly in the chat box.

Every MMM script command must start with _!mmm_ – that's how Roll20 knows to send what follows to the MMM scripting engine. The _!mmm_ prefix must be followed by an MMM command (described below).

Scripts can be as short as a single command:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **chat:** Hello World! | ***Finn:*** Hello World!

You can also put a whole sequence of commands together, one after another in separate lines:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **chat:** Oh dear, I'm pretty banged up. | ***Finn:*** Oh dear, I'm pretty banged up.
| 2    | _!mmm_ **do** setattr(sender, "HP", getattrmax(sender, "HP")) | *(set HP attribute to its maximum)*
| 3    | _!mmm_ **chat:** /me is back at ${getattr(sender, "HP")} points. | ***Finn is back at 25 points.***

Each of these commands would be executed as soon as the MMM scripting engine receives it. That's possible because each of the commands above is *self-contained:* It has everything it needs to execute in the same line.

However, some commands enclose a *block* of other commands – for example, if you want to *conditionally* execute some commands:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **if** getattr(sender, "HP") < 5 | *(check HP attribute)*
| 2    | _!mmm_     **chat:** /me is nearly dead! | ***Finn is nearly dead!***
| 3    | _!mmm_ **end if**

In the previous example, **if** is a block command: All commands that follow the **if** command down to the **end if** command are a *block* of commands that's only going to be executed if the **if** condition is true. In general, every block command ends with a corresponding **end *block*** command.

You may have noticed that the **chat:** command in the example above has been moved to the right (by inserting extra spaces) in relation to the **if** and **end if** commands. That's completely up to you! Extra spaces between the _!mmm_ prefix and the command (and, in general, anywhere else) are ignored. *Indenting* the commands in a block relative to their enclosing block command is a time-honored practice among programmers – it simply makes the script's structure easier to see.

As you're writing longer and more complex scripts, it's good practice to enclose them in a **script** block:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **chat:** /me rolls [[1d20+12]] attack! | ***Finn rolls `29` attack!***
| 3    | _!mmm_     **if** $[[0]] >= 20 | *(check first roll from previous line)*
| 4    | _!mmm_         **chat:** Eat these [[1d6]] damage, evil foe! | ***Finn:*** Eat these `5` damage, evil foe!
| 5    | _!mmm_     **end if**
| 6    | _!mmm_ **end script**

Using a **script** block is optional, but if you do, it gives you the following benefits:

- The **script** block resets any unfinished previous block command you may have sent to the MMM scripting engine before (e.g. an **if** you sent earlier that you accidentally left without an **end if** to finish it up).
- Script execution is delayed until **end script** is received.
- If anything goes wrong inside the **script** block (e.g. you have a typo in a command), you'll get just one error message and the entire script won't be executed.

Inside a **script** block, you can use *variables*.

*Variables* allow you to store roll results and other computed values so you can refer back to them any future point in the **script** block:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **set** AttackRoll = [[1d20+12]] | *(assign roll result to variable)*
| 3    | _!mmm_     **if** AttackRoll >= 20 | *(check if attack roll was successful)*
| 4    | _!mmm_         **chat:** Attack with ${AttackRoll} dealing [[1d6]] damage | ***Finn:*** Attack with `23` dealing `3` damage
| 5    | _!mmm_     **else**
| 6    | _!mmm_         **chat:** Attack with ${AttackRoll} failed | *(not executed)*
| 7    | _!mmm_     **end if**
| 8    | _!mmm_ **end script**

You can freely choose your variable names as long as they only contain letters (A-Z, a-z), digits (0-9), and underscores (_). Variable names cannot contain other punctuation or spaces. Upper- and lowercase spelling is significant (so attackRoll, AttackRoll, and attackroll are three different variables).

Once set, the lifetime of variables only extends to the next **end script** command. If you want to save state between different scripts or script runs, consider using character attributes.


### _!mmm_ **script** [...] **end script**

Defines a script that's executed as a whole.

The **script** command also flushes any previous incomplete commands that might still be in the chat queue. This means that a script wrapped in a **script** block will reliably execute regardless of whatever happened before. It also means it's impossible to nest **script** blocks, but since the **script** command does nothing else, that's never necessary anyway.

See above (and below) for examples.


### _!mmm_ **chat:** *template*

Sends text to the chat impersonating the player or character who sent the script.

The template is simple text that can contain ${expression} placeholders. When the **chat** command is executed, all ${expression} placeholders are evaluated and substituted into the template text.

You can use /me, /whisper, and any other Roll20 chat directives in a **chat** command. 

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **chat:** /me is bored. | ***Finn is bored.***
| 2    | _!mmm_ **chat:** Attacking with [[1d20+12]] | ***Finn:*** Attacking with `14`
| 3    | _!mmm_ **chat:** My half-life is ${getattr(sender, "HP") / 2}. | ***Finn:*** My half-life is 11.5.

If the template is completely absent, the **chat** command sends a line break instead of just nothing. Together with **combine chat** (described below) you can use this to add some visual structure to your chat messages without going to the extreme of just sending several separate messages (oh my!):

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **combine chat**
| 2    | _!mmm_     **chat:** Attack with [[1d20+12]] | *(queue message part)*
| 3    | _!mmm_     **chat:** | *(queue line break)*
| 4    | _!mmm_     **chat:** Here's [[1d6]] damage for you just in case | *(queue message part)*
| 5    | _!mmm_     **chat:** | *(queue line break)*
| 6    | _!mmm_     **chat:** Sorry for the trouble! | *(queue message part)*
| 7    | _!mmm_ **end combine** | ***Finn:*** Attack with `23`<br>Here's `2` damage for you just in case<br>Sorry for the trouble!


### _!mmm_ **combine chat** [...] **end combine**

You can wrap a **combine chat** block around **chat** and other commands to combine all **chat** outputs within that block into a single chat output line. That's useful if you want to build a longer chat message with conditional parts – or if you'd just like to break a really long message line up into something that's easier to read.

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **combine chat**
| 2    | _!mmm_     **chat:** Attack with [[1d20+12]] | *(queue message part containing attack roll)*
| 3    | _!mmm_     **if** $[[0]] >= 20 | *(check attack roll)*
| 4    | _!mmm_         **chat:** dealing [[1d6]] damage | *(queue message part containing damage roll)*
| 5    | _!mmm_     **else**
| 6    | _!mmm_         **chat:** failed | *(not executed)*
| 7    | _!mmm_     **end if**
| 8    | _!mmm_ **end combine** | ***Finn:*** Attack with `23` dealing `2` damage


### _!mmm_ **combine chat using** *expression* [...] **end combine**

By default, the parts of the message are separated with spaces when the **combine chat** command builds the final chat message. If you'd like something different to separate the parts (e.g. nothing, or a custom separating character or character sequence), use the **combine chat using** variant of the command:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **combine chat using** "" | *(evaluate separator expression: empty string)*
| 2    | _!mmm_     **chat:** Finn M | *(queue message part)*
| 3    | _!mmm_     **chat:** acRath | *(queue message part)*
| 4    | _!mmm_     **chat:** gar | *(queue message part)*
| 5    | _!mmm_ **end combine** | ***Finn:*** Finn MacRathgar


### _!mmm_ **if** *expression* [...] **else if** *expression* [...] **else** [...] **end if**

Executes other commands conditionally.

The **if** and **else if** commands evaluate their expression (which will usually include a comparison of some sort), and...

- If the result is true, execute the commands that follow until the next **else if**, **else**, or **end if** on the same level is reached, and then skip everything down to the **end if** command that completes the **if** block.
- If the result is false, skip the commands that follow until the next **else if**, **else**, or **end if** on the same level is reached.

You can use any commands inside an **if** block included other, nested **if** blocks.

That said – anything that's evaluated by the Roll20 macro engine *before* the command is sent to the MMM scripting engine will be always be executed unconditionally by Roll20 before MMM gets a shot at it. So while you absolutely *can* use inline rolls like `[[1d6]]`, roll queries like `?{Bonus|0}`, and attribute calls like `@{Finn|HP}` in your scripts, you *cannot* make them conditional by placing them inside an **if** block.

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **set** Health = @{Finn\|HP} | *(assign current HP to Health variable)*
| 3    | _!mmm_     **if** Health >= 0.8 * @{Finn\|HP\|max} | *(check if 80% healthy or more)*
| 4    | _!mmm_         **chat:** I feel sufficiently invigorated!
| 5    | _!mmm_     **else if** ?{Heal if necessary?\|yes,true\|no,false} | *(less than 80% healthy – use result of roll query)*
| 6    | _!mmm_         **chat:** /me gulps a healing potion for [[1d6]] health. | *(chat with inline roll result)*
| 7    | _!mmm_         **set** Health = min(Health + $[[0]], @{Finn\|HP\|max}) | *(calculate new Health limited to max)*
| 8    | _!mmm_         **do** setattr("Finn", "HP", Health) | *(set HP to updated Health)*
| 9    | _!mmm_     **else**
| 10   | _!mmm_         **chat:** Feeling bad and no healing potion. Woe is me!
| 11   | _!mmm_     **end if**
| 12   | _!mmm_ **end script**

In the example above, the "Heal if necessary?" question will pop up even before the entire script runs – actually, just when the **else if** line is received by the Roll20 chat engine and before it's sent to the MMM scripting engine. So this question will be asked even if Finn is sufficiently healthy to not even want healing. Unfortunately, the only way to make roll queries conditional is with conventional (and limited) Roll20 macro magic.


### _!mmm_ **set** *variable* = *expression*

Evaluates an expression and assigns its results to a variable. If the variable doesn't exist yet, it's created; if it already exists, its previous value is replaced.

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **set** CurCount = getattr(sender, "AmmoCount") | *(stores AmmoCount attribute value in CurCount variable)*
| 3    | _!mmm_     **set** MaxCount = getattrmax(sender, "AmmoCount") | *(stores AmmoCount attribute max value in MaxCount variable)*
| 4    | _!mmm_     **set** FindProb = ?{Probability?\|100} / 100 | *(calculates FindProb variable from roll query result)*
| 5    | _!mmm_     **set** FindCount = round(FindProb * (MaxCount - CurCount)) | *(calculates and assigns FindCount variable)*
| 6    | _!mmm_     **set** CurCount = CurCount + FindCount | *(updates CurCount variable)*
| 7    | _!mmm_     **chat:** Found ${FindCount} ammo, have ${CurCount} now | ***Finn:*** Found 7 ammo, have 18 now
| 8    | _!mmm_ **end script**


### _!mmm_ **do** *expression*

Evaluates an expression. This is useful if the expression has side effects, e.g. changes a character attribute. (If the expression returns a result, the result is discarded.)

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **do** setattr(sender, "HP", min(getattr(sender, "HP") + [[1d6]], getattrmax(sender, "HP")) | *(add 1d6 HP, up to max HP)*
| 2    | _!mmm_ **do** setattr(sender, "AmmoCount", getattr(sender, "AmmoCount") - 1) | *(decrement AmmoCount attribute)*
| 3    | _!mmm_ **do** chat("/me likes chatting the hard way") | ***Finn likes chatting the hard way***


### _!mmm_ **exit *block***

Stops executing commands in this block and instead returns control to the command following the next **end *block*** – or no further command at all in case of **exit script**.

The most common use of this would be to exit an entire script early to avoid having to wrap most of it in (yet another) **if** block:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **chat:** Attacking with [[1d20+12]] | ***Finn:*** Attacking with `17`
| 3    | _!mmm_     **if** $[[0]] < 20 | *(check attack success)*
| 4    | _!mmm_         **exit script** | *(no success – stop script)*
| 5    | _!mmm_     **end if**
| 6    | _!mmm_     **chat:** And it's a hit! | *(not executed)*
| 7    | _!mmm_     **chat:** /me swings his longsword aptly and with elegance. | *(not executed)*
| 8    | _!mmm_     **chat:** Take these [[1d6+1]] points of damage, despicable wretch! | *(not executed)*
| 9    | _!mmm_ **end script**

But you can actually exit any block, not just **script** blocks:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **combine chat**
| 3    | _!mmm_         **chat:** Attacking with [[1d20+12]] | *(queue message part with roll)*
| 4    | _!mmm_         **if** not iscritical($[[0]]) | *(check critical attack success)*
| 5    | _!mmm_             **exit combine** | *(no critical success – stop bragging)*
| 6    | _!mmm_         **end if**
| 7    | _!mmm_         **chat:** in a fashion not yet seen by the world! | *(not executed)*
| 8    | _!mmm_         **chat:** Volumes will be written about this! | *(not executed)*
| 9    | _!mmm_         **chat:** Entire generations will model themselves after Finn! | *(not executed)*
| 10   | _!mmm_     **end combine** | ***Finn:*** Attacking with `23`
| 11   | _!mmm_     **if** $[[0]] >= 20 | *(check attack success)*
| 12   | _!mmm_         **chat:** Anyway, here's [[1d6+1]] points of damage. | ***Finn:*** Anyway, here's `3` points of damage.
| 13   | _!mmm_     **end if**
| 14   | _!mmm_ **end script**

This really applies to any kind of block, even **if** blocks, though it might be considered bad taste – or at least extremely unorthodox and frowned-upon by traditional programmers – to exit **if** blocks. Plus, it might look like you're stuttering if you're using the **exit *block* if** variant described below. But if it works, it works... right?


### _!mmm_ **exit *block*** **if** *expression*

Shorthand for doing **exit *block*** inside an **if** block because that's a pretty common thing to do. This:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **exit script if** attackRoll < 20 | *(exit script if attack failed)*

...works exactly like this:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **if** attackRoll < 20 | *(check if attack failed)*
| 2    | _!mmm_     **exit script** | *(if so, exit script)*
| 3    | _!mmm_ **end if**

Just use whichever you prefer.



## Expressions

Expressions are used everywhere: in **set** and **do** commands; as the condition in **if** and **else if** commands; for the separator in the **combine chat using** command; and even inside ${...} placeholders in the message text for the **chat** command.

If a command contains an expression (or several, like in a **chat** command), the expression is evaluated when the command is *executed* using the most up-to-date variable values. This is unlike what happens with native Roll20 inline rolls, roll queries, or attribute calls, which are executed (and then substituted into the command) when the command is *sent* to the MMM scripting engine, before any part of the script executes.

Expressions can contain...

- Numbers like `42`, `3.14`, or `-1`
- Text strings in double quotes like `"foo"` or single quotes like `'bar'` – the quotes are just there to demark the string, not part of it. If you want to include a literal double quote in a double-quoted string, or a literal single quote in a single-quoted one, you can prefix it with a backslash like so: `"Finn \"The Gorgeous\" MacRathgar"` – and same if you want to include a literal backslash in a string: `"lean\\left"`
- Boolean logic values `true` and `false`
- Mathematical operators like `+` `-` `*` `/` and many more – see list below
- Boolean logic operators `and`, `or`, and `not`
- Function calls like `floor(num)`, `getattr(char,attrname)`, and `max(a,b,c...)` – see list below

Operators follow the usual precedence rules, so `1+2*3` means `1+(2*3)` – you can always use parentheses to override operator precedence, e.g. `(1+2)*3`.


### Literals

| Syntax      | Description
| ----------- | -----------
| `42`        | Integral number
| `3.14`      | Fractional number
| `-1.2`      | Negative (integral or fractional) number
| `"foo"`     | Double-quoted string representing `foo` 
| `'bar'`     | Single-quoted string representing `bar`
| `"a\"b\\c"` | String representing `a"b\c` (double- or single-quoted)
| `true`      | Boolean logic value representing true condition
| `false`     | Boolean logic value representing false condition


### Variables

| Syntax      | Description
| ----------- | -----------
| `AmmoCount` | References the value of the variable named `AmmoCount`
| `$[[0]]`    | References a recent roll or inline roll

The MMM scripting engine keeps track of your recent rolls for you – explicit rolls and inline rolls, both within and outside of script commands – so you can reference them using the `$[[0]]` syntax in script expressions and templates. An explicit roll always sets `$[[0]]` whereas inline rolls set `$[[0]]` and `$[[1]]` and so on, one for each pair of `[[ ]]` in the message that contained the rolls. (The exact details of how they're numbered is subject to Roll20's dice engine, but the gist of it is: from most deeply nested to top-most, and on each nesting level from left to right.)

You can use attribute calls like `@{Finn|HP}` as well, but keep in mind that they're substituted into the script command *before* the MMM scripting engine even sees it. That's unproblematic if the attribute is a plain number, but if it's a string, you must explicitly surround the attribute call with quotes:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **set** TargetName = "@{target\|x\|token_name}" | *(set TargetName variable to name of selected target – use quotes)*
| 2    | _!mmm_ **set** TargetHealth = @{target\|x\|HP} | *(set TargetHealth variable to current health of selected target – numeric, no quotes required)*

There are also a few special *context variables* that are pre-set for you:

| Variable   | Example  | Description
| ---------- | -------- | -----------
| `playerid` |          | Player ID (not character ID!) of the player who sent the command
| `sender`   | "Finn"   | Player or character name who sent the command – subject to the chat "As" drop-down box
| `version`  | "1.0.1"  | [Semantic version number](https://semver.org) of the MMM scripting engine
| `pi`       | 3.141... | [Ratio of a circle's circumference to its diameter](https://en.wikipedia.org/wiki/Pi) – useful for geometric calculations

You can *shadow* these special context variables by setting a custom variable with the same name (and your custom variable will then take precedence for the remainder of the script), but you can't truly change them.


### Attributes

Like in macros, you can query *attributes* in MMM expressions – and even create and update them if you like:

- Use the `getattr()` and `getattrmax()` functions to query attribute values and max values.
- Use the `setattr()` and `setattrmax()` functions to update (or, if necessary, create) attributes and max values.

All of these functions take a *name|id* value as their first argument. You can pass a character ID, token ID, character name, or token name. (If you're passing a name and there's ambiguity, MMM always chooses characters over tokens, and if multiple characters should have the same name, it'll choose one at random. IDs are always unambiguous.)

If a token represents a specific character (e.g. your character token on the board), it doesn't matter whether you address the token or the character – you'll get access to all attributes of both through either.

MMM has a more general notion of what attributes are than Roll20 itself and adds a few of its own:

| Attribute         | Example              | Value? | Max?  | Description
| ----------------- | -------------------- | ------ | ----- | -----------
| `permission`      | `"control"`          | read   |       | `"none"`, `"view"`, or `"control"` – see below
| `name`            | `"Finn"`             | read   |       | Character or token name
| `token_id`        |                      | read   |       | Token ID
| `token_name`      | `"Finn's Spiderbro"` | read   |       | Token name – provided for Roll20 parity
| `character_id`    |                      | read   |       | Character ID
| `character_name`  | `"Finn"`             | read   |       | Character name – provided for Roll20 parity
| `bar1`            | `20` / `30`          | write  | write | Token's top bar value – middle circle (default green)
| `bar2`            | `20` / `30`          | write  | write | Token's middle bar value – right circle (default blue)
| `bar3`            | `20` / `30`          | write  | write | Token's bottom bar value – left circle (default red)
| `left`            | `350` / `1750`       | write  | read  | Token's X coordinate on the table       
| `top`             | `350` / `1750`       | write  | read  | Token's Y coordinate on the table       
| *(anything else)* |                      | write  | write | Character attribute – e.g. `HP` or any custom attribute

But keep in mind that just because an attribute *can be accessed* per this table, that doesn't mean *you* can access it.

You can't access anything through MMM you couldn't access manually in the game. For example, you can only read the `left` attribute of a token you can see on the table, or the `HP` attribute of a character you control yourself.

The one exception of this rule is the special `permission` attribute: That one's always there for you to read, even on tokens and characters you're not allowed to access at all or that don't even exist, in which case it'll be `"none"`. Otherwise it can be either `"view"` (you can see aspects of it but not change) or `"control"` (it's yours and you can do anything with it).

Individual attributes may have further restrictions – for example, even if you can see an NPC token, you might not be able to read its `name` unless the GM has made it visible.

If you try to read or write an attribute you don't have permission to, you'll get a special null value back that resolves to zero in numeric context, an empty string in string contaxt, `false` in boolean logic context, and that'll render as the word `denied` on a pretty red background when sent to chat.


### Operators

| Syntax         | Precedence  | Category | Description
| -------------- | ----------- | -------- | -----------
| *a* `**` *b*   | 1 (highest) | Math     | Calculate *a* to the power of *b*
| `+`*a*         | 2           | Math     | Return *a* unchanged (even if *a* is not a number)
| `-`*a*         | 2           | Math     | Negate *a*
| *a* `*` *b*    | 3           | Math     | Multiply *a* with *b*
| *a* `/` *b*    | 3           | Math     | Divide *a* by *b*
| *a* `%` *b*    | 3           | Math     | Calculate the remainder (modulus) of dividing *a* by *b*
| *a* `+` *b*    | 4           | Math     | Add *a* and *b*
| *a* `-` *b*    | 4           | Math     | Subtract *b* from *a*
| *a* `&` *b*    | 4           | String   | Concatenate *a* and *b*
| *a* `<` *b*    | 5           | Logic    | Return `true` if *a* is numerically less than *b*, else `false`
| *a* `<=` *b*   | 5           | Logic    | Return `true` if *a* is numerically less than or equal to *b*, else `false`
| *a* `>` *b*    | 5           | Logic    | Return `true` if *a* is numerically greater than *b*, else `false`
| *a* `>=` *b*   | 5           | Logic    | Return `true` if *a* is numerically greater than or equal to *b*, else `false`
| *a* `==` *b*   | 6           | Logic    | Return `true` if *a* is numerically equal to *b*, else `false`
| *a* `!=` *b*   | 6           | Logic    | Return `true` if *a* is numerically unequal to *b*, else `false`
| *a* `eq` *b*   | 6           | Logic    | Return `true` if *a* is alphanumerically equal to *b*, else `false`
| *a* `ne` *b*   | 6           | Logic    | Return `true` if *a* is alphanumerically unequal to *b*, else `false`
| *a* `and` *b*  | 7           | Logic    | Return `true` if *a* and *b* are both `true`, else `false`
| *a* `or` *b*   | 8           | Logic    | Return `true` if *a* or *b* or both are `true`, else `false`
| `not` *a*      | 9 (lowest)  | Logic    | Return `true` if *a* is `false`, or `false` if *a* is `true`

If you want to calculate the square root of something, you can use the power-of operator with a fractional exponent: `val**(1/2)`


### Functions

| Syntax                                             | Category  | Example | Description
| -------------------------------------------------- | --------- | ------- | -----------
| floor(*a*)                                         | Math      | floor(1.7) = 1   | Return the greatest integer that's less than or equal to *a*
| round(*a*)                                         | Math      | round(1.5) = 2   | Round *a* to the nearest integer
| ceil(*a*)                                          | Math      | ceil(1.3) = 2    | Return the smallest integer that's greater than or equal to *a*
| abs(*a*)                                           | Math      | abs(-5) = 5      | Return the absolute value of *a*
| min(...)                                           | Math      | min(3,1,2) = 1   | Return the numerically smallest value – any number of arguments allowed
| max(...)                                           | Math      | max(3,1,2) = 3   | Return the numerically greatest value – any number of arguments allowed
| sin(*degrees*)                                     | Math      | sin(90) = 1      | Return the sine of *degrees*
| cos(*degrees*)                                     | Math      | cos(90) = 0      | Return the cosine of *degrees*
| tan(*degrees*)                                     | Math      | tan(45) = 1      | Return the tangent of *degrees*
| asin(*x*)                                          | Math      | asin(1) = 90     | Return the angle (-90...+90 degrees) whose sine is *x*
| acos(*x*)                                          | Math      | acos(0) = 90     | Return the angle (-90...+90 degrees) whose cosine is *x*
| atan(*x*)                                          | Math      | atan(1) = 45     | Return the angle (-90...+90 degrees) whose tangent is *x*
| atan(*down*, *right*)                              | Math      | atan(3,1) = 71.6 | Return the angle (-180...+180 degrees) required to rotate a rightward-facing object such that it will point toward something offset by *right* and *down* on the game board
| len(*str*)                                         | String    | len("foo") = 3   | Return the number of character in string *str*
| literal(*str*)                                     | String    | literal("1<2") = "1\&lt;2" | Escape all HTML control characters in string *str*
| highlight(*str*)                                   | String    |  | When output to chat, highlight string *str* with a pretty box
| highlight(*str*, *type*)                           | String    |  | ...with a colored outline depending on *type* = "normal", "important", "good", "bad"
| highlight(*str*, *type*, *tooltip*)                | String    |  | ...with a tooltip popping up on mouse hover
| roll(*expr*)                                       | Roll      | roll("1d20+12") = 23 | Run a roll through Roll20's dice engine and return its result
| iscritical(*roll*)                                 | Roll      |  | Return `true` if any die in the roll had its greatest value (e.g. 20 on 1d20), else `false`
| isfumble(*roll*)                                   | Roll      |  | Return `true` if any die in the roll had its smallest value (e.g. 1 on 1d20), else `false`
| distunits()                                        | Board     | distunits() = "m"    | Return name of distance units used on the current game board
| distscale()                                        | Board     | distscale() = 0.0714 | Return number of game board distance units per pixel
| distsnap()                                         | Board     | distsnap() = 70      | Return number of pixels between grid lines – if grid lines disabled, zero
| chat(*str*)                                        | Chat      | chat("Hi!") | **[Side effect]** Send string *str* to chat
| findattr(*name\|id*)                               | Character | findattr("Finn") | List available character sheet table names – see below
| findattr(*name\|id*, *table*)                      | Character | findattr("Finn", "attack") | List available columns in a character sheet table – see below
| findattr(*name\|id*, *table*, *col*, *val*, *col*) | Character | findattr("Finn", "attack", "weapon", "Slingshot", "damage") | Find attribute name in a character sheet table – see below
| getcharid(*name\|id*)                              | Character | getcharid("Finn") | Return the character ID for *name\|id*
| getattr(*name\|id*, *attr*)                        | Character | getattr("Finn", "HP") | Look up attribute *attr* for *name\|id*
| getattrmax(*name\|id*, *attr*)                     | Character | getattrmax("Finn", "HP") | Look up maximum value of attribute *attr* for *name\|id*
| setattr(*name\|id*, *attr*, *val*)                 | Character | setattr("Finn", "HP", 17) | **[Side effect]** Set attribute *attr* for *name\|id* to *val*, then return *val* – create *attr* if necessary
| setattrmax(*name\|id*, *attr*, *val*)              | Character | setattr("Finn", "HP", 17) | **[Side effect]** Set maximum value of attribute *attr* for *name\|id* to *val* – create *attr* if necessary


## Recipes

### Using findattr() to determine character sheet attribute names

The `findattr()` function helps you determine the attribute name to query (or update) anything that's in an extensible table in a character sheet.

These attribute names always start with `repeating_`... followed by a table name (e.g. `attack`), followed by a soup of random characters (the row ID), and finally the name of column you're interested in (e.g. `damage`). Official [Roll20 guidance](https://help.roll20.net/hc/en-us/articles/360037256794-Macros#Macros-ReferencingRepeatingAttributes) says to break out your HTML debugger and dive into the character sheet's HTML source to figure out these IDs – but that's a pants-on-fire–grade way to have to go about this.

With `findattr()` you can do all this without leaving the safe comfort of your chat box:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **chat:** Tables: ${findattr(sender)} | ***Finn:*** Tables: attack, defense, armor
| 2    | _!mmm_ **chat:** Columns: ${findattr(sender, "attack")} | ***Finn:*** Columns: weapon, skill, damage
| 3    | _!mmm_ **chat:** Attribute: ${findattr(sender, "attack", "weapon", "Slingshot", "damage")} | ***Finn:*** Attribute: repeating_attack_-MSxAHDgxtzAHdDAIopE_damage
| 4    | _!mmm_ **chat:** Value: ${getattr(sender, findattr(sender, "attack", "weapon", "Slingshot", "damage"))} | ***Finn:*** Value: 1d6

What's happening in the last two lines above is that you're *selecting* one of the rows based on a condition: In this case, you want to get to the `damage` attribute of the `attack` table row that has the value `Slingshot` in its `weapon` column – so, the damage dealt by your slingshot. You can include several pairs of *column*, *value* to narrow down your selection if necessary.

Unlike most other things in MMM, table names, column names, and column values are case-insensitive in the `findattr()` function.


### Using atan() to rotate a token to face another token

The `atan()` function is useful when you want to figure out how one token is *oriented* towards another.

Here is a script that will rotate the *selected* token so that it visually faces a *target* token (which you'll be prompted to click when the script runs):

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **set** selectedToken = "@{selected\|token_id}" | *(get selected token – will be rotated)*
| 3    | _!mmm_     **set** targetToken = "@{target\|Target\|token_id}" | *(get target token – selected token will be oriented facing it)*
| 4    | _!mmm_     **set** targetOffsetRight = getattr(targetToken, "left") - getattr(selectedToken, "left") | *(calculate horizontal offset of target from selected)*
| 5    | _!mmm_     **set** targetOffsetDown = getattr(targetToken, "top") - getattr(selectedToken, "top") | *(calculate vertical offset of target from selected)*
| 6    | _!mmm_     **set** rotation = atan(targetOffsetDown, targetOffsetRight) | *(calculate rotation from selected towards target)*
| 7    | _!mmm_     **do** setattr(selectedToken, "rotation", -90 + rotation) | *(apply rotation to selected – assume token visually faces down, not right)*
| 8    | _!mmm_ **end script**

Most character (and monster) tokens in the Roll20 marketplace are made to look like the character (or monster) is facing downwards on the screen. But the `atan()` function would return "zero degrees of rotation" if the target was exactly *to the right* of the selected token on the screen. So the `-90` in the `setattr()` call (in line 7) compensates for that – it means "you'd have to rotate the token 90 degrees counterclockwise to make it face the right side of the screen", and then the actual rotation towards the target is added.

If you're mathematically inclined, it may seem odd to you that `rotation` and `atan()` are working with angles in *clockwise* degrees. That's because the Roll20 board has its vertical coordinate axis pointing downwards rather than upwards – common on computers, not so much in maths.



## Frequently Asked Questions

### After installing MMM, will my old macros still work or do I have to rewrite everything?

You don't have to rewrite anything – everything that used to work still works even with MMM installed. (I don't think I even *could* make it not-work even if I wanted to. Not that I do.)

Installing MMM just opens up new possibilities for you. It doesn't remove any.


### Do you do bugs? I think I found one.

Never. But the cat might. I'll have to revoke his commit rights one of these days. (I don't have a cat.)


### Okay, so, I think I found a bug *the cat made*. How do I report it?

Please [open a ticket on GitHub](https://github.com/michael-buschbeck/mychs-macro-magic/issues). I'll see to it that it gets the cat's attention, stat.

Maybe look around before you open a new issue – perhaps someone else has encountered the same bug, and perhaps there's already discussion and workarounds (or even a fix!) available.


### But I already told you in chat/person/Discord!

That's great! Love the human touch. Please [open a ticket on GitHub](https://github.com/michael-buschbeck/mychs-macro-magic/issues).


### But I don't have a GitHub account!

They're free and [really easy to make](https://github.com/join?ref_cta=Sign+up&ref_loc=header+logged+out&ref_page=%2F%3Cuser-name%3E%2F%3Crepo-name%3E%2Fissues%2Findex&source=header-repo&source_repo=michael-buschbeck%2Fmychs-macro-magic)!

(That's assuming you're not a robot. If you are, you might have a slight issue here. I can refer you to the cat for pointers, but note that he can be a bit of an ass sometimes.)


### I have an awesome idea for a new feature!

Brilliant! I really appreciate (and enjoy) your enthusiasm, and I'm eager to hear your idea.

Please [open a ticket on GitHub](https://github.com/michael-buschbeck/mychs-macro-magic/issues) – you can add the `enhancement` label if you like – so we can discuss it and flesh it out.


### Okay, but I really need that feature. I'm willing to pay you.

I appreciate your willingness to pay me, and I acknowledge what that implies about your request.

But I'm already doing software dev as a full-time salaried job (which is fun too, if always driven by business impact and whatnot), so to pay me you'd have to compete with *them*, and that's gonna be expensive.

In my free time, I exclusively program for my own fun.

Luckily for you, I'm completely tolerant of and open to *bribes*. Potentially effective bribes include:

- Write something substantial and favorable about MMM in your blog and send me a link. I'm a sucker for positive attention.
- Contribute to MMM in other, non-programming ways – e.g. by writing docs, translating docs, writing examples, or answering community questions.
- Send me a diversely filled crate of *interesting* craft beer. If nothing else it'll put me into a mellow mood regarding your request.

That's not an exhaustive list. I love to see how the software I write affects other humans positively, so... just be creative. I'm sure we can figure something out, subject to disposable free time on my part.



## Versions

You can check your installed version by running this command from the chat box:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **chat:** Installed MMM version: ${version} | ***Finn:*** Installed MMM version: 1.9.0

If nothing is sent to chat at all after entering this command, MMM isn't installed in your game. Go pester your GM to get it done!

| Version | Date       | What's new?
| ------- | ---------- | -----------
| 1.9.0   | 2021-02-06 | Support `rotation` token attribute and trigonometric functions
| 1.8.0   | 2021-02-05 | Support line breaks in chat messages
| 1.7.0   | 2021-02-05 | Add `exit` command to exit a block or the entire script
| 1.6.0   | 2021-02-04 | Add `roll(expr)` to run a roll through Roll20's dice engine
| 1.5.0   | 2021-02-01 | Add string concatenation operator
| 1.4.0   | 2021-02-01 | Provide access to game board distance metrics
| 1.3.0   | 2021-01-30 | Unify character and token attribute access
| 1.2.0   | 2021-01-28 | Perform permission checks on attribute queries
| 1.1.0   | 2021-01-28 | Support `character_id` and `character_name` pseudo-attributes
| 1.0.0   | 2021-01-26 | Initial release

For details on patch releases and bugfixes, check the [commit history](https://github.com/michael-buschbeck/mychs-macro-magic/commits/main/MychsMacroMagic.js) on GitHub.



## Copyright & License

**Mych's Macro Magic** was created by Michael Buschbeck <michael@buschbeck.net> (2021).

It can be freely used and distributed under the [MIT License](https://choosealicense.com/licenses/mit/) provided this license and copyright notice are retained.
