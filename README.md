# Mych's Macro Magic

A simple, sane, and friendly little scripting language for your Roll20 macros.

- Tired of writing macros that look like the cat had an uneasy dream (again!) on your keyboard?
- Stockholm syndrome just not working for you to keep you enchanted with that soup of brackets, braces, and strings of seemingly random dice-roll suffixes you wrote yesterday?
- Your [sense of pride and accomplishment](https://www.reddit.com/r/MuseumOfReddit/comments/8ish3t/the_time_that_ea_got_a_sense_of_pride_and/) not kicking in anymore like it used to after spending hours of figuring out how to bully the dice engine into comparing two numbers?

And that distant, lingering, but unmistakable yearning, like an unscratchable itch at the back of your mind, calling softly at you as if from afar: "How easy would this be if I could just use a proper *conditional* here?", and: "How nice if I didn't have to put all this stuff into *one* line?", and: "If I could just use *one tiny* variable here, that would be so handy..."

If that sounds familiar, then **Mych's Macro Magic (MMM)** is here for you. Just install it as an API script and start writing macro scripts like a boring, *productive* programmer would.

You're here to yell at dice, not at macros, after all – right?


### Contents

- [Scripts](#scripts) – [script commands](#mmm-script--end-script), [autorun macros](#autorun-macros)
- [Expressions](#expressions) – [literals](#literals), [variables](#variables), [lists](#lists), [structs](#structs), [attributes](#attributes), [operators](#operators), [functions](#functions)
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
| 2    | _!mmm_ **do** setattr(sender, "HP", sender.HP.max) | *(set HP attribute to its maximum)*
| 3    | _!mmm_ **chat:** /me is back at ${sender.HP} points. | ***Finn is back at 25 points.***

Each of these commands would be executed as soon as the MMM scripting engine receives it. That's possible because each of the commands above is *self-contained:* It has everything it needs to execute in the same line.

However, some commands enclose a *block* of other commands – for example, if you want to *conditionally* execute some commands:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **if** sender.HP < 5 | *(check HP attribute)*
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

The template is simple text that can contain `${expression}` placeholders. When the **chat** command is executed, all ${expression} placeholders are evaluated and substituted into the template text.

You can use /me, /whisper, and any other Roll20 chat directives in a **chat** command. 

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **chat:** /me is bored. | ***Finn is bored.***
| 2    | _!mmm_ **chat:** Attacking with [[1d20+12]] | ***Finn:*** Attacking with `14`
| 3    | _!mmm_ **chat:** My half-life is ${sender.HP / 2}. | ***Finn:*** My half-life is 11.5.

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

Chat messages sent through the **chat** command impersonate the `sender` running the script. You can set the `sender` variable to something else to impersonate some other character or token you control:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **chat:** Behold my gentle features, so pretty! | ***Finn:*** Behold my gentle features, so pretty!
| 3    | _!mmm_     **set** sender = "Spiderbro" | *(impersonate another character under the player's control)*
| 4    | _!mmm_     **chat:**  /me rolls his eyes. All six of them. | ***Spiderbro rolls his eyes. All six of them.***
| 5    | _!mmm_ **end script**

You can set `sender` to any character name, token name, character ID, or token ID. If you set it to an invalid value of if the player doesn't have control permission for the character or token, your customized `sender` value will be ignored and your chat message will be sent as the player running the script.


### _!mmm_ **chat [**<span>_label_</span>**]:** *template*

Like **chat** but allows the template to be customized (or translated) with a **translate** command in a **customize** block. The brackets around **\[**<span>_label_</span>**\]** are literal.

If there's any `${expression}` placeholder in the chat message template, you should add a label to it like so: `$[foo]{expression}` – this makes it possible to reference the expression's result in the translated chat message. In the **translate** command corresponding to this **chat** command, the player can then use `$[foo]` to substitute `${expression}` into their translated message (without even having to know the details of the expression).

See the [**customize** block](#mmm-customize--end-customize) for examples and an extended description.


### _!mmm_ **translate [**<span>_label_</span>**]:** *template*

Use **translate** in a **customize** block to provide a customization (or translation) of a **chat** message. The brackets around **\[**<span>_label_</span>**\]** are literal.

The bracketed **\[**<span>_label_</span>**\]** following the **translate** keyword specifies which **chat** message to customize: It's the **chat** command with the same **\[**<span>_label_</span>**\]**. Labels are case-sensitive like variable names. If the script doesn't contain a **chat** command with this **\[**<span>_label_</span>**\]**, nothing happens.

The translated template can reference any `$[foo]{expression}` in the original **chat** message by using `$[foo]` as a placeholder. The corresponding `$[foo]{expression}` will be evaluated when the **chat** command runs, and its result will then be substituted into the translated message. If there is no corresponding labeled expression in the original **chat** message, the `$[foo]` placeholder is kept in the translated message as-is – an easy way to see that something's amiss (perhaps a typo).

See the [**customize** block](#mmm-customize--end-customize) for examples and an extended description.


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


### _!mmm_ **for** *variable* **in** *expression* [...] **end for**

Executes a block of commands once for each element from a list given by *expression*. Assigns each element in turn to *variable* (in the same order elements appear in the list) and then executes the block before continuing with the next element (if any).

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **for** color **in** "red", "green", "blue" | *(start of loop)*
| 2    | _!mmm_     **chat:** Do you feel ${color} today? | ***Finn:*** Do you feel red today?<br>***Finn:*** Do you feel green today?<br>***Finn:*** Do you feel blue today?
| 3    | _!mmm_ **end for** | *(end of loop)*

After the last iteration, the *variable* is deleted again. However, if you use **exit for** to exit the loop early before all elements are exhausted, *variable* retains its most recent value:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **for** token **in** selected | *(loop over all selected tokens)*
| 3    | _!mmm_         **exit for if** token.HP > 10 | *(exit loop early if token is healthy enough)*
| 4    | _!mmm_     **end for**
| 5    | _!mmm_     **if** token | *(did the loop exit early?)*
| 6    | _!mmm_         **chat:** ${token.name} seems healthy enough! | ***Finn:*** Yorric seems healthy enough!
| 7    | _!mmm_     **else**
| 8    | _!mmm_         **chat:** Everyone seems pretty banged up.
| 9    | _!mmm_     **end if**
| 10   | _!mmm_ **end script**

Useful things you can loop over:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **for** thing **in** "sword", "mug", "hat" | *(just a hard-coded bunch of similar things)*
| 2    | _!mmm_ **for** tokenId **in** selected | *(all tokens currently selected by the player)*
| 3    | _!mmm_ **for** tableName **in** findattr(sender) | *(all character sheet tables)*
| 4    | _!mmm_ **for** columnName **in** findattr(sender, table) | *(all column names of a character sheet table)*
| 5    | _!mmm_ **for** attrName **in** findattr(sender, table, column) | *(all attribute names in one column for all rows of a character sheet table)*

You can also nest loops if you want – but be careful not to accidentally flood the chat with messages or even stall the entire game because you're going again and again and again and _again_ through your innermost nested loop.


### _!mmm_ **set** *variable* = *expression*

Evaluates an expression and assigns its results to a variable. If the variable doesn't exist yet, it's created; if it already exists, its previous value is replaced.

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **set** CurCount = sender.AmmoCount | *(stores AmmoCount attribute value in CurCount variable)*
| 3    | _!mmm_     **set** MaxCount = sender.AmmoCount.max | *(stores AmmoCount attribute max value in MaxCount variable)*
| 4    | _!mmm_     **set** FindProb = ?{Probability?\|100} / 100 | *(calculates FindProb variable from roll query result)*
| 5    | _!mmm_     **set** FindCount = round(FindProb * (MaxCount - CurCount)) | *(calculates and assigns FindCount variable)*
| 6    | _!mmm_     **set** CurCount = CurCount + FindCount | *(updates CurCount variable)*
| 7    | _!mmm_     **chat:** Found ${FindCount} ammo, have ${CurCount} now | ***Finn:*** Found 7 ammo, have 18 now
| 8    | _!mmm_ **end script**


### _!mmm_ **set customizable** *variable*

Declares a variable that must be **set** in a **customize** block before this script runs.

If there is no **customize** block in front of this script – or if there is, but this variable isn't **set** in it –, the script stops with an error message saying that this variable needs a customized value but doesn't have one. If you'd rather like a default value to be assigned in this case, use the **set customized** variant below (with default expression).

This behavior forces players to use a **customize** block and provide a customization for this variable, making it impossible to run the script on its own. That's better than providing a bad default that breaks the script for some (or all) players when left uncustomized. For example, there probably isn't any particular "default ranged weapon" that every character has in their character sheet – each player must make a conscious decision which of their character's weapons to use.

See the [**customize** block](#mmm-customize--end-customize) for examples and an extended description.


### _!mmm_ **set customizable** *variable* = *expression*

Declares a variable that *can* (but doesn't have to) be **set** in a **customize** block before this script runs. If there's no customization for this variable, evaluates the expression and assigns its result to the variable.

Defaults shouldn't be documentation – if you provide a default, make sure the script does something reasonable with it regardless of who runs it. If that's not possible, use the **set customizable** variant above (without a default expression) to force players to provide a customization for this variable.

If you want to use a default that's more complex than a simple expression, you can use the special `default` indicator value and then check with `isdefault()` if the variable was left at its default:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **set customizable** WeaponName = **default** | *(use special default indicator value)*
| 3    | _!mmm_     **if** isdefault(WeaponName) | *(check if WeaponName was left uncustomized)*
| 4    | _!mmm_         **set** FirstWeaponSkill = sender.("repeating_attack_$0_skill") | *(get first weapon skill from character sheet)*
| 5    | _!mmm_         **set** SecondWeaponSkill = sender.("repeating_attack_$1_skill") | *(get second weapon skill from character sheet)*
| 6    | _!mmm_         **if** FirstWeaponSkill > SecondWeaponSkill | *(compare weapon skills)*
| 7    | _!mmm_             **set** WeaponName = sender.("repeating_attack_$0_weapon") | *(default to first weapon if greater skill than second)*
| 8    | _!mmm_         **else**
| 9    | _!mmm_             **set** WeaponName = sender.("repeating_attack_$1_weapon") | *(default to second weapon otherwise)*
| 10   | _!mmm_         **end if**
| 11   | _!mmm_     **end if**
| 12   | _!mmm_     **chat:** /me attacks with ${WeaponName}! | ***Finn attacks with slingshot!***
| 13   | _!mmm_ **end script**

See the [**customize** block](#mmm-customize--end-customize) for examples and an extended description.


### _!mmm_ **do** *expression*

Evaluates an expression. This is useful if the expression has side effects, e.g. changes a character attribute. (If the expression returns a result, the result is discarded.)

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **do** setattr(sender, "HP", min(sender.HP + [[1d6]], sender.HP.max) | *(add 1d6 HP, up to max HP)*
| 2    | _!mmm_ **do** setattr(sender, "AmmoCount", sender.AmmoCount - 1) | *(decrement AmmoCount attribute)*
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


### _!mmm_ **function** _funcname_**()** [...] **end function**

Defines a custom function that you can call – like any of the [built-in functions](#functions) – as part of any expression you like. For example, you can define a custom function that sends a cheer to chat and call it in a **do** command:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **function** cheer() | *(define custom function called `cheer`)*
| 3    | _!mmm_         **chat:** Rejoice! | *(commands to execute when function is called)*
| 4    | _!mmm_     **end function**
| 5    | _!mmm_     **do** cheer() | ***Finn:*** Rejoice!
| 6    | _!mmm_     **chat:** I have defeated our enemy! | ***Finn:*** I have defeated our enemy!
| 7    | _!mmm_     **do** cheer() | ***Finn:*** Rejoice!
| 8    | _!mmm_ **end script**

You can use any commands you like (and any number of commands) between **function** and **end function**. The commands you put inside a **function** block are called the _function body_. You can even put nested **function** blocks inside a function body; the nested function will be available only in the function that contains it.

Functions defined inside a **script** block can be called any time after their definition but only inside the same **script** block – it has the same lifetime as a script variable. If a function is defined outside a **script** block, it becomes a _global function_ that can be called from anywhere (but only by the player that defined it).

A function body works like a mini-script inside your script and gets its own, clean variable stash so you can't accidentally overwrite any of the script's variables. If you need to _read_ any of the script's variables, you can do so by accessing them through the special `script` variable available only in function bodies:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **function** cheer() | *(define custom function called `cheer`)*
| 3    | _!mmm_         **chat:** Rejoice! ${script.message} | *(use `script.message` to read the script's variable)*
| 4    | _!mmm_     **end function**
| 5    | _!mmm_     **set** message = "I have done a great deed!" | *(set variable `message` read by function)*
| 6    | _!mmm_     **do** cheer() | ***Finn:*** Rejoice! I have done a great deed!
| 7    | _!mmm_     **set** message = "I have defeated our enemy!" | *(set variable `message` read by function)*
| 8    | _!mmm_     **do** cheer() | ***Finn:*** Rejoice! I have defeated our enemy!
| 9    | _!mmm_ **end script**

This lets you pass information into your function: Set some script variables before a function call and read them through the `script` variable in the function body. It's sometimes more convenient to define and use _function parameters_ though; see the next section for details on that.

To pass information back from your function to the script code that called it, use the [**return** command](#mmm-return-expression).


### _!mmm_  **function** _funcname_**(**_param1_**,** _param2_**,** _..._**)** [...] **end function**

Like the **function** command described in the previous section, but defines a function that has one or several _parameters_.

When you call this function in an expression, you can supply a list of _function arguments_ in parentheses – one function argument per parameter you've defined for your function:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **function** boast(action) | *(define function `boast` with one parameter called `action`)*
| 3    | _!mmm_         **chat:** Rejoice! I have ${action}! | *(use value passed in `action` parameter)*
| 4    | _!mmm_     **end function**
| 5    | _!mmm_     **do** boast("done a great deed") | ***Finn:*** Rejoice! I have done a great deed!
| 6    | _!mmm_     **do** boast("defeated our enemy") | ***Finn:*** Rejoice! I have defeated our enemy!
| 7    | _!mmm_ **end script**

This works just as well as setting a script variable and reading it through the special `script` variable in the function body except it's more concise. What's more, it also works when you want to pass information into a custom function from inside another custom function – in contrast, the `script` variable only allows access to the main script's variables.

If you supply fewer function arguments in a call than there are parameters defined for the function, all parameters than don't get an explicit argument value are assigned the special `default` value. You can use the built-in `isdefault()` function to check if a parameter was omitted in the function call:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **function** boast(action, exclamation) | *(define function `boast` with parameters `action` and `exclamation`)*
| 3    | _!mmm_         **if** isdefault(exclamation) | *(check if `exclamation` argument was omitted)*
| 4    | _!mmm_             **set** exclamation = "Rejoice" | *(set `exclamation` to default value if necessary)*
| 5    | _!mmm_         **end if**
| 6    | _!mmm_         **chat:** \${exclamation}! I have \${action}! | *(use values in `action` and `exclamation` parameters)*
| 7    | _!mmm_     **end function**
| 8    | _!mmm_     **do** boast("done a great deed") | ***Finn:*** Rejoice! I have done a great deed!
| 9    | _!mmm_     **do** boast("defeated our enemy", "Behold") | ***Finn:*** Behold! I have defeated our enemy!
| 10   | _!mmm_ **end script**


### _!mmm_ **return**

Exits a function immediately. Can only be used inside a [**function** block](#mmm-function--end-function).

This variant of the **return** command (without an expression to return) works exactly the same as the [**exit function** command](#mmm-exit-block) – you can use either or both interchangeably. The **return** command with an expression to return is more interesting – see the next section for details.


### _!mmm_ **return** *expression*

Exits a function immediately and makes it return a value. Can only be used inside a [**function** block](#mmm-function--end-function).

This command is how you can pass information back from within a function body to the script code that called the function. Consider the [built-in functions](#functions): Most of them take one or several arguments, do some function-specific processing with them, and then _return_ a result – for example, `min(a,b)` returns the lesser of its `a` and `b` arguments.

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **function** attack(skill, modifiers) | *(define function `attack` with parameters `skill` and `modifiers`)*
| 3    | _!mmm_         **set** effectiveAttackRoll = roll("1d20") + modifiers | *(roll and add modifiers)*
| 4    | _!mmm_         **return** effectiveAttackRoll >= skill | *(return `true` if attack succeeded, else `false`)*
| 5    | _!mmm_     **end function**
| 6    | _!mmm_     **if** attack(sender.SwordSkill) | *(roll attack with sword, no modifiers)*
| 7    | _!mmm_         **chat:** I've landed a hit with my sword! | ***Finn:*** I've landed a hit with my sword!
| 8    | _!mmm_     **else if** attack(sender.SlingshotSkill, -1) | *(roll attack with slingshot with modifier)*
| 9    | _!mmm_         **chat:** I've hit them with my slingshot even though they're close!
| 10   | _!mmm_     **end if**
| 11   | _!mmm_ **end script**

Notice that the `attack(sender.SwordSkill)` call only passes a value for the `skill` parameter but omits an argument for the `modifiers` parameter – so `modifiers` becomes the special `default` value in the function, which is interpreted as zero when it's added to the roll result.


### _!mmm_ **publish to sender:** *variable*|*function*, *variable*|*function*, ...

Makes the specified variables and/or functions available to all scripts that follow.

- For functions, this works the same as when you simply use the [**function** command](#mmm-function-funcname--end-function) on top level outside of any **script** block to make a _global function_.

- For variables, this copies the variable's current value and makes it available under the variable's name to all scripts that follow. The result is much like a _global variable_ except it's not really variable – though you can overwrite it, of course, by re-publishing another variable under the same name.

In any script code that follows, you can access these published variables and/or functions without further ado just by their names like you'd access any of your script's variables.

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **set** mood = "happy" | *(set script variable `mood` to "happy")*
| 3    | _!mmm_     **publish to sender:** mood | *(copy "happy" to global variable named `mood`)*
| 4    | _!mmm_     **set** mood = "gloomy" | *(set script variable `mood` to "gloomy")*
| 5    | _!mmm_ **end script**
| 6    | _!mmm_ **script** | *(start next script with new script variables)*
| 7    | _!mmm_     **chat:** /me is ${mood} today! | ***Finn is happy today!***
| 8    | _!mmm_ **end script**

If you **set** a script variable of the same name as a **publish**-ed one or define a **function** of the same name, this _shadows_ (hides) their global versions and gives precedence to your script's definitions. Shadowing a variable or function doesn't affect its global counterpart for subsequent scripts. 


### _!mmm_ **publish to game:** *variable*|*function*, *variable*|*function*, ...

Like **publish to sender** except it makes the specified variables and/or functions available to all scripts that follow for ***all players*** in the game. This command ***requires GM privileges*** – if a normal player attempts to use it in a script, the entire script won't even run.

Useful to share a suite of functions among all players in the game or to let the GM set and change values that can be used by players' scripts.

If a GM uses **publish to game** with a custom **function**, a powerful feature is that the function executes with the GM's privileges even when called by a player: Most significantly, the GM's published function can access (and even update) any character's or NPC's attributes, not just the caller's.

Of course this means you have to be careful what functions you publish to your players as a GM, but on the other hand it can also be used to very restrictively give players access to certain NPC properties without accidentally leaking more information than you care to let them know.

For example, let's say that player characters get an extra attack bonus if their target's "constitution" stat has dropped below 25% of its maximum. You don't really want to tell your players any details about your NPC's current or maximum constitution, but you do want to let them know if they can apply this bonus to their next attack. So this is what you can do:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script** | *(script run by the GM once at game start)*
| 2    | _!mmm_     **function** CanUseAttackBonus(target) | *(define function named `CanUseAttackBonus`)*
| 3    | _!mmm_         **set** constitution = target.constitution | *(get current constitution)*
| 4    | _!mmm_         **set** threshold = 0.25 * target.constitution.max | *(calculate threshold for attack bonus)*
| 5    | _!mmm_         **return** constitution < threshold | *(return `true` if less than threshold, else `false`)*
| 6    | _!mmm_     **end function**
| 7    | _!mmm_     **publish to game:** CanUseAttackBonus | *(publish function `CanUseAttackBonus` to all players)*
| 8    | _!mmm_ **end script**
|      | 
| 1    | _!mmm_ **script** | *(script run by a player)*
| 2    | _!mmm_     **set** target = "@{target\|Target?\|token_id}" | *(let player select target on tabletop)*
| 3    | _!mmm_     **if** CanUseAttackBonus(target) | *(call GM's function to check attack bonus)*
| 4    | _!mmm_         **chat:** Attack with bonus: [[1d20+4]] | *(use attack bonus if applicable)*
| 5    | _!mmm_     **else**
| 6    | _!mmm_         **chat:** Normal attack: [[1d20]] | *(use normal attack if bonus not applicable)*
| 7    | _!mmm_     **end if**
| 8    | _!mmm_ **end script**


### _!mmm_ **customize** [...] **end customize**

Placed before a **script** block to customize it. In a **customize** block, use **set** and **translate** commands to customize variables and chat messages in the script that follows.

Consider this script:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **set customizable** AmmoName = "ammo" | *(assign default "ammo" to AmmoName)*
| 3    | _!mmm_     **set** StartAmmoCount = sender.(AmmoName) | *(get current ammo count from attribute "ammo")*
| 4    | _!mmm_     **if** StartAmmoCount == 0 | *(check if there's still ammo left)*
| 5    | _!mmm_         **chat** **[**<span>OutOfAmmo</span>**]:** Out of ammo | ***MrBore:*** Out of ammo
| 6    | _!mmm_     **else**
| 7    | _!mmm_         **set** EndAmmoCount = setattr(sender, AmmoName, StartAmmoCount - 1) | *(decrement attribute "ammo" and assign to EndAmmoCount)*
| 8    | _!mmm_         **chat** **[**<span>UsedAmmo</span>**]:** Used one, have $[NumAmmo]{EndAmmoCount} ${AmmoName} left | ***MrBore:*** Used one, have 13 ammo left
| 9    | _!mmm_     **end if**
| 10   | _!mmm_ **end script**

This script does a useful thing even if it's a bit dry in terms of style and flavor – and there's only one type of ammo (boringly called "ammo") it supports. What of Finn's arrows and slingshot balls? Luckily enough, the script was made to be *customizable* to let players change some aspects of it without having to meddle with its source code:

- It uses **set customizable** (instead of just **set**) for the `AmmoName` assignment, allowing this variable to be customized.
- Every **chat** command has a **[**_label_**]** so that the chat message can be translated.

So if a player wants to customize the script, they just have to place a **customize** block in front of it:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **customize**
| 2    | _!mmm_     **set** AmmoName = "arrows" | *(customize AmmoName to be "arrows" instead of "ammo")*
| 3    | _!mmm_     **translate** **[**<span>OutOfAmmo</span>**]:** My quiver is empty! Lucky bastards! | *(customize chat message)*
| 4    | _!mmm_     **translate** **[**<span>UsedAmmo</span>**]:** Shot an arrow, and $[NumAmmo] more to come. | *(customize chat message and include remaining arrows)*
| 5    | _!mmm_ **end customize**
| 6    | _!mmm_ **script**
| 7    | _!mmm_     **set customizable** AmmoName = "ammo" | *(assign "arrows" to AmmoName – ignore "ammo")*
| 8    | _!mmm_     **set** StartAmmoCount = sender.(AmmoName) | *(get current ammo count from attribute "arrows")*
| 9    | _!mmm_     **if** StartAmmoCount == 0 | *(check if there are still arrows left)*
| 10   | _!mmm_         **chat** **[**<span>OutOfAmmo</span>**]:** Out of ammo | ***Finn:*** My quiver is empty! Lucky bastards!
| 11   | _!mmm_     **else**
| 12   | _!mmm_         **set** EndAmmoCount = setattr(sender, AmmoName, StartAmmoCount - 1) | *(decrement attribute "arrows" and assign to EndAmmoCount)*
| 13   | _!mmm_         **chat** **[**<span>UsedAmmo</span>**]:** Used one, have $[NumAmmo]{EndAmmoCount} ${AmmoName} left | ***Finn:*** Shot an arrow, and 13 more to come.
| 14   | _!mmm_     **end if**
| 15   | _!mmm_ **end script**

For this to work, the **customize** block must run immediately before the **script** block to be customized. Whatever command, command block, or even *erroneous* command comes after **customize** will consume and then flush all customizations made by it.

You can stack multiple **customize** blocks in front of a **script** block. Customizations will complement one another. If the same variable or chat message is customized more than once, the last customization takes precedence. You can use this, for example, to first apply a general **customize** block that translates all chat messages from "boring programmer" to "charming good-looking rogue" and then a second **customize** block that specializes the script for "arrows" carried in "quivers" versus "slingshot balls" carried in "leather bags" and whatnot.

Script customization comes in handy if the script source isn't under the player's control. For example, the GM may have validated and approved a rather complex (and customizable) ranged-attack script. The GM provides this script as a shared Roll20 macro to all players. Each player in turn creates a mini-macro that starts with a **customize** block and then calls the GM-provided generic attack script.

So with the entire **script** [...] **end script** block above moved to a Roll20 macro named `UseAmmoScript` and shared by the GM, Finn can create his own customized version for shooting arrows (with typical roguish charm and style) just like this:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **customize**
| 2    | _!mmm_     **set** AmmoName = "arrows" | *(customize AmmoName to be "arrows" instead of "ammo")*
| 3    | _!mmm_     **translate** **[**<span>OutOfAmmo</span>**]:** My quiver is empty! Lucky bastards! | *(customize chat message)*
| 4    | _!mmm_     **translate** **[**<span>UsedAmmo</span>**]:** Shot an arrow, and $[NumAmmo] more to come. | *(customize chat message and include remaining arrows)*
| 5    | _!mmm_ **end customize**
| 6    | **#UseAmmoScript** | *(call shared Roll20 macro containing the customizable script)*


### _!mmm_ **customize export to** *destination*

When placed before a **script** (or a **customize** block in front of it), saves a new **customize** block template containing all customizable variables and chat messages to a macro named *destination* (and also sends it to the player's chat).

If *destination* is `chat`, no macro is created, and the **customize** block template is only sent to the player's chat.

Any existing script customization is included the exported template, so you only have to update what you didn't customize before. If **customize export** is run on an uncustomized script, the template just contains the default values of variables and the chat messages the script would use without customization.

If a macro named *destination* already exists, a backup of the existing macro is saved, and all non-_!mmm_ lines at the beginning and the end of the existing macro are copied to the updated version of it. (For example, lines at the beginning could be Roll20 macro calls that include general script translation or customization, and a line at the end might be a macro call to the customizable script itself.)

Note that this is a single-line command, not a block.


### _!mmm_ **customize export to** *destination* **without backup**

Like **customize export** above, just without the backup.

Convenient if you don't do very fancy things in your **customize** blocks and don't need no stinkin' backup macros cluttering up your macro library.


### _!mmm_ **debug chat:** *template*

Like **chat** but made for debugging, so it does two things differently:

- It whispers the chat message back at you instead of posting it to public chat.
- If there is any ${expression} placeholder in the chat message template, its result is substituted into the whispered message with a special highlight and as if it were an expression literal. While that's not as pretty, it has the benefit of being completely unambiguous as to what you're getting there: a number, or a string, or an undefined value, or a list, or whatever else.

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **debug chat:** Current health: ${sender.HP} | *(Whisper):*  Current health: `"23"`
| 2    | _!mmm_ **debug chat:** Half health: ${sender.HP / 2} | *(Whisper):*  Half health: `11.5`
| 3    | _!mmm_ **debug chat:** Health not great: ${sender.HP < 5} | *(Whisper):*  Health not great: `false`
| 4    | _!mmm_ **debug chat:** Attribute tables: ${findattr(sender)} | *(Whisper):*  Attribute tables: `"attack", "defense", "armor"`

The way this command is designed, you can just slap the `debug` keyword in front of any old `chat` command in your script to get some extra insight into how it's composed (or why it doesn't work the way you thought). This even works if there's a **[**_label_**]** for translation, which will be ignored.

You can't combine **debug chat** outputs with **combine chat** – they'll simply be ignored by **combine chat** (because they're whispered directly to you).


### _!mmm_ **debug do** *expression*

Like **do** but made for debugging, so it does one thing differently:

- The result of evaluating the expression as well as the expression itself are both whispered back to you (and *then* the result is discarded).

Using **debug do** is most useful as a way to quickly get insight into the contents of variables or function call outputs:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **debug do** CurrentHealth | *(Whisper):*  `9` ◄ `CurrentHealth`
| 2    | _!mmm_ **debug do** sender.EP | *(Whisper):*  `17` ◄ `sender.EP`
| 3    | _!mmm_ **debug do** "initial", CurrentHealth, CurrentEndurance | *(Whisper):*  `"initial", 9, 17` ◄ `"initial", CurrentHealth, CurrentEndurance`

The effect of **debug do** is similar to putting a `???` debug operator (see [operators](#operators) below) in front of the expression of a regular **do** command. The difference between using one or the other is mostly one of convenience: Use `???` if you want to look into an expression that's integral part of your script's operation, and **debug do** if you plan on removing this debug output again once you're done debugging. It's just easier to keep track of what to keep and what to delete after a debugging session that way.


### Autorun macros

If you're using [global functions](#mmm-function-funcname--end-function), you need a place to define them before they're used.

This place could simply be any old macro (or character ability) along with some emphatic guidance to players that they _must_ call this macro (just once) before they want to use your script. That works, but... you know, it's like that old joke about the [Portuguese computer virus](https://www.hanselman.com/blog/a-poor-mans-computer-virus).

Fortunately, MMM's support for _autorun macros_ can help: Any macro whose name starts with `!mmm-autorun` or `!mmm_autorun` (uppercase or lowercase don't matter) will be run automatically by MMM as soon as your game's API sandbox has completed spinning up and loading your game.

If there's more than just one macro matching this naming pattern, they're all executed one by one in the same order they show up in your macro list. MMM first looks for autorun macros across all players, then puts (all of) them in this order, and then runs them in that order. Macros defined by GMs are run first, then those defined by non-GM players.

MMM runs every autorun macro impersonating its _owner_, so you can do and access in an autorun macro whatever you can normally do or access. You can even send messages to chat. (Whether there's anyone around to read them is a separate question.)

Since autorun macros aren't run interactively (by a player clicking a button or sending a chat message), you're slightly limited in what non-MMM features are supported in them:

- You _can_ use inline rolls `[[1d20]]`, execute `/roll` commands, and use the `roll()` function.
- You _can_ reference attributes as `@{Finn|HP}` and abilities as `%{Finn|RollAttack}` but those references must specify the character they relate to explicitly.
- You **_cannot_** do roll queries like `?{Bonus|0}` or select target tokens with `@{target|token_id}` – there's no one around to answer these queries.
- You **_cannot_** reference other macros via `#MacroName`. (This may be changed in a future MMM version, but it'll require MMM to resolve those macros itself instead of Roll20.)

One final wrinkle: If you mix direct chat in an autorun macro with `!mmm chat:` script commands, you'll find that the script's chat output will arrive in chat after _all_ of the macro's direct chat output.


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

| Variable     | Example   | Description
| ------------ | --------- | -----------
| `playerid`   |           | Player ID (not character ID!) of the player who sent the command
| `privileged` | `false`   | Player has GM privileges – for [autorun macros](#autorun-macros), determined when the macro is saved
| `sender`     | "Finn"    | Player or character name who sent the command – subject to the chat "As" drop-down box
| `selected`   |           | List of token IDs of the tokens currently selected by the player on the game board – may be empty
| `version`    | "1.0.1"   | [Semantic version number](https://semver.org) of the MMM scripting engine
| `pi`         | 3.141...  | [Ratio of a circle's circumference to its diameter](https://en.wikipedia.org/wiki/Pi) – useful for geometric calculations
| `default`    | `default` | Special indicator value that makes `set customizable` apply the default expression
| `denied`     | `denied`  | Special indicator value returned by `getattr()` and `setattr()` when accessing attributes without permission
| `unknown`    | `unknown` | Special indicator value returned by a function when it is unable to produce a meaningful result given its arguments and/or the current state of the game

Don't attempt to use the `default`, `denied`, and `unknown` indicator values in comparisons: They're neither numbers nor strings, and when compared as such they'll compare equal to many completely benign values that are neither `default` nor `denied` nor `unknown` (like the number zero or an empty string). Use the `isdefault()`, `isdenied()`, and `isunknown()` functions to find out if something is one of these special indicator values.

You can *shadow* these special context variables by setting a custom variable with the same name (and your custom variable will then take precedence for the remainder of the script), but you can't truly change them, and MMM itself will always use their original values anyway.

All `denied` and `unknown` values that were *returned by a function* carry some useful diagnostics with them: When rendered to chat (where they show up as the words "denied" or "unknown" on a pretty colored background), you can point your mouse at them to get a tooltip that tells you exactly what went wrong – or, in the case of `denied`, at least exactly what the script attempted that got denied. To get programmatic access to the diagnostic reason carried by a `denied` or `unknown` result, use the `getreason()` function.


### Lists

Sometimes it's just not enough to put just _one_ of a thing in an expression or a variable – for example, maybe you want a list of the names of _all_ members of your party, or you'd like a list of all of Finn's many exquisite personality traits so you can later refer back to them.

You can make a list simply by separating individual values with commas:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **set** partyNames = "Finn MacRathgar", "Yorric MacRathgar", "Baigh MacBeorn" | *(several character names)*
| 2    | _!mmm_ **set** finnsPersonality = "smart", "pretty", "streetwise", "fierce", 42 | *(small sample of Finn's personality traits)*
| 3    | _!mmm_ **set** nextThreeRolls = [[1d20]], [[1d20]], [[1d20]] | *(three attack rolls)*

Things you can put in lists:
- Numbers, rolls, strings, `true`, `false`, key-value pairs, the result of `highlight()`, and basically everything that renders as anything in chat.
- Special indicator values: `unknown` and `denied` (including their diagnostics) and `default`.

Things you cannot put in lists:
- Undefined values – an undefined value (or variable) will be treated as an empty list. If you try to include an undefined value in a list, it will be ignored.
- Other lists – instead of making a list of lists, the elements of the nested list you're trying to include in an outer list are added to the outer list.

Any single value that _could_ be part of a list will be treated as a single-element list when a list is asked for.

This behavior comes in handy if you want to append or prepend items to a list variable: An undefined variable will be treated as an (initially) empty list, and you can add to it simply by using the comma operator:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script** | *(variable* things *starts out as undefined – list has zero elements initially)*
| 2    | _!mmm_     **chat:** I've got ${things} | ***Finn:*** I've got
| 3    | _!mmm_     **set** things = things, "something", 123 | *(append two values to initially empty list – list has two elements now)*
| 4    | _!mmm_     **chat:** I've got ${things} | ***Finn:*** I've got something, 123
| 5    | _!mmm_     **set** things = true, 456, things | *(prepend two values to the list – list has four elements now)*
| 6    | _!mmm_     **chat:** I've got ${things} | ***Finn:*** I've got true, 456, something, 123
| 7    | _!mmm_ **end script**

You can access any specific item in a list by its index using brackets like in `list[idx]` – the index can be any kind of expression, of course, not just a literal number:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **set** things = "hat", "rope", "slingshot", "pie" | *(four list items – index goes from 0 to 3)*
| 3    | _!mmm_     **chat:** My first thing is a ${things[0]}. | ***Finn:*** My first thing is a hat.
| 4    | _!mmm_     **chat:** Next, a ${things[1]}. | ***Finn:*** Next, a rope.
| 5    | _!mmm_     **set** lastThing = things[-1] | *(use negative index to count from the back)*
| 6    | _!mmm_     **chat:** Last but not least, a ${lastThing}. | ***Finn:*** Last but not least, a pie.
| 7    | _!mmm_     **set** noThing = things[99] | *(index out of bounds simply returns an undefined value)*
| 8    | _!mmm_ **end script**

Of course, lists are most useful together with the [**for** loop](#mmm-for-variable-in-expression--end-for), which allows you to execute a block of code once for each list element in turn.


### Structs

While lists allow you to look up individual items by index (see [previous section](#lists)), structs allow you to access items by string-valued keys that are meaningful to you, just like variable names.

You can create and use a struct like this:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **set** weapon = {type: "slingshot", ammo: 12} | *(create struct with keys `type` and `ammo`)*
| 3    | _!mmm_     **chat:** My \${weapon.type} has \${weapon.ammo} shots left. | ***Finn:*** My slingshot has 12 shots left.
| 4    | _!mmm_     **set** weapon = {weapon, ammo: (weapon.ammo - 1)} | *(keep `type` and reduce value of `ammo` by one)*
| 5    | _!mmm_     **chat:** Down to \${weapon.ammo} \${weapon.type} shots now! | ***Finn:*** Down to 11 slingshot shots now!
| 6    | _!mmm_ **end script**

In this example, both `type: "slingshot"` and `ammo: 12` are so-called key-value pairs – with `type` and `ammo` being the lookup keys, and `"slingshot"` and `12` the corresponding values.

- The key is always a string, and most often one that looks like a variable name.
  - There's special support in the MMM expression parser to interpret something that looks like a variable name but followed by a `:` (colon) as the literal key of a key-value pair rather than "a variable followed by a colon".
  - If you want a key that _doesn't_ look like a variable name, you'll have to put it in quotes:  `"!=": true`
  - If you want to calculate the key from an expression or variable value, enclose it in parentheses:  `("foo" & bar): value`
- The value can be anything you like: a string, number, boolean, list, roll result, the result of calling `highlight()`, another struct, another key-value pair (if that makes sense to you), `undef`, or one of the special indicator values `default`, `denied`, and `unknown` – if you can put it in a variable, you can put it in the value of a key-value pair.
- Use `pair.key` to get the key from a key-value pair and `pair.value` to get the value.

Enclosing a list of key-value pairs in braces `{`...`}` creates a struct. You can use `struct.foo` to directly look up the value corresponding to the `foo` key in a struct. If another struct is included between the braces, its keys and values are individually included in the newly created struct.

Structs are most useful when you want to have a list of them. For just a single item like in the example above, you could just as well use individual normal variables like `weaponType` and `weaponAmmo`. But if you want to keep a list of several such items with several properties each, it's much more convenient to create a list of structs:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **script**
| 2    | _!mmm_     **set** weapons = weapons, {type: "slingshot", ammo: 12} | *(add slingshot to `weapons` list)*
| 3    | _!mmm_     **set** weapons = weapons, {type: "shortbow", ammo: 8} | *(add shortbow to `weapons` list)*
| 4    | _!mmm_     **set** weapons = weapons, {type: "longsword"} | *(add longsword to `weapons` list – doesn't have `ammo`)*
| ...  |
| 20   | _!mmm_     **chat:** Behold my arsenal: | ***Finn:*** Behold my arsenal: 
| 21   | _!mmm_     **for** weapon **in** weapons | *(loop over all weapons)*
| 22   | _!mmm_         **combine chat** 
| 23   | _!mmm_             **chat:** One ${weapon.type} | ***Finn:*** One *(weapon type)*...
| 24   | _!mmm_             **if** weapon.ammo > 0 | *(include ammunition info only if there is any)*
| 25   | _!mmm_                 **chat:** with ${weapon.ammo} shots | ...with *(ammo count)* shots
| 26   | _!mmm_             **end if**
| 27   | _!mmm_         **end combine**
| 28   | _!mmm_     **end for** | ***Finn:*** One slingshot with 12 shots<br>***Finn:*** One shortbow with 8 shots<br>***Finn:*** One longsword
| 29   | _!mmm_ **end script**

Common operations on structs:

- Create a struct:  `{key1: value1, key2: value2,` ...`}`
- Add more keys to an existing struct:  `{struct, key3: value3,` ...`}`
- Combine several structs (last value wins if keys are duplicated):  `{struct1, struct2,` ...`}`
- Replace an existing key's value:  `{struct, key1: value4}`
- Remove a key from a struct:  `{struct... where ...key ne "key1"}`

If you use a struct in string context, it renders as a comma-separated list of its key-value pairs (with or without markup depending on context). Used as a number, a struct evaluates as the number of its keys (or values). As a boolean, a struct is `true` if it contains any keys at all and `false` if it is empty.

The `...` postfix operator – unlike any other MMM operator put _after_ its operand, like `struct...` – applies to a struct and returns the list of key-value pairs in it. The key-value pairs extracted from a struct in this way are always in alphanumerical order of their keys, regardless of which order they were originally defined in. (You can also abuse this to sort arbitrary things by a string key.)

This operator can also be used on anything else that supports the `obj.prop` property lookup syntax – most importantly characters and tokens, which return a list of key-value pairs enumerating the [attributes and pseudo-attributes](#attributes) stored for the character or token. If you use it on a list of things, it'll return the combined list of key-value pairs from all list elements including any duplicates. (It doesn't work on a single key-value pair though; it just returns the key-value pair as-is.)


### Attributes

Like in macros, you can query *attributes* in MMM expressions – and even create and update them if you like:

- Use `name`|`id.attrname`, `name`|`id.attrname.max`, or the `getattr()` and `getattrmax()` functions to query attribute values and max values.
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
| `page`            | `"-MRZtlN_1XJe4k"`   | read   |       | Page ID on which the token is displayed
| `bar1`            | `20` / `30`          | write  | write | Token's top bar value – middle circle (default green)
| `bar2`            | `20` / `30`          | write  | write | Token's middle bar value – right circle (default blue)
| `bar3`            | `20` / `30`          | write  | write | Token's bottom bar value – left circle (default red)
| `status_`...      | `true`               | write  |       | Token's status markers – `false` to hide, `true` to show, or any single digit to show with an overlay – see below
| `left`            | `350` / `1750`       | write  | read  | Token's X coordinate on the table
| `top`             | `350` / `1750`       | write  | read  | Token's Y coordinate on the table
| `width`           | `70`                 | write  |       | Token's width (subject to its rotation)
| `height`          | `70`                 | write  |       | Token's height (subject to its rotation)
| `rotation`        | `45`                 | write  |       | Token's clockwise rotation in degrees
| *(anything else)* |                      | write  | write | Character attribute – e.g. `HP` or any custom attribute


**Tables:** MMM exposes a special character property named `repeating` that gives you access to the contents of all tabular data in the character sheet. The `repeating` property contains a struct with one key for each table; each table is a list of rows; each row is a struct whose keys are the column names in the table.

For example, if there's a table named `Weapons` with columns named `Type` and `Skill`, you could read values from this table like so:

- `char.repeating.Weapons[0].Type` – type of the character's first weapon
- `(char.repeating.Weapons where ...Type eq "slingshot").Skill` – character's slingshot skill (or `unknown` if not found)
- `(char.repeating.Weapons select ...Type)` – list of all of the character's weapon types

The `repeating` character property makes the `findattr()` function mostly redundant (but the function is still there if you want it).

**Status markers:** The `status_`... attributes show or hide token status markers. Most markers – with the notable exception of the "dead" marker, that big red cross covering the entire token – also support displaying a single digit as an overlay, which can be useful for counters and the like.

If a status marker is displayed *without* a numeric overlay, its status will be returned as the string `"shown"` rather than `true`. That seems odd, but it makes using the return value more convenient: In boolean context (for example, in an `if` statement), the string `"shown"` is interpreted as `true` (like any non-empty string) – but in numeric context (like when you want to calculate something with it), `"shown"` is interpreted as zero (whereas `true` would be interpreted as the number 1).

You can find a full list of available token status marker names in the [official API docs](https://help.roll20.net/hc/en-us/articles/360037772793-API-Objects#API:Objects-ImportantNotesAboutStatusMarkers) (search for "full list of status markers"). Here in MMM, the corresponding attribute names use underscores (_) in place of any dashes (-), so you'd use the `status_all_for_one` attribute to get to the "all-for-one" marker, for example.

**Permissions:** Keep in mind that just because an attribute *can be accessed* per this table, that doesn't mean *you* can access it.

You can't access anything through MMM you couldn't access manually in the game. For example, you can only read the `left` attribute of a token you can see on the table, or the `HP` attribute of a character you control yourself.

The one exception of this rule is the special `permission` attribute: That one's always there for you to read, even on tokens and characters you're not allowed to access at all or that don't even exist, in which case it'll be `"none"`. Otherwise it can be either `"view"` (you can see aspects of it but not change) or `"control"` (it's yours and you can do anything with it).

Individual attributes may have further restrictions – for example, even if you can see an NPC token, you might not be able to read its `name` unless the GM has made it visible.

If you try to read or write an attribute you don't have permission to, you'll get a special null value back that resolves to zero in numeric context, an empty string in string context, `false` in boolean logic context, and that'll render as the word `denied` on a pretty red background when sent to chat. You can use the `isdenied()` function to distinguish between a regular attribute value that doesn't exist and this special indicator value.


### Operators

| Syntax                 | Precedence  | Category | Description
| ---------------------- | ----------- | -------- | -----------
| *a* `**` *b*           | 1 (highest) | Math     | Calculate *a* to the power of *b*
| `+`*a*                 | 2           | Math     | Return *a* unchanged (even if *a* is not a number)
| `-`*a*                 | 2           | Math     | Negate *a*
| *a* `*` *b*            | 3           | Math     | Multiply *a* with *b*
| *a* `/` *b*            | 3           | Math     | Divide *a* by *b*
| *a* `%` *b*            | 3           | Math     | Calculate the remainder (modulus) of dividing *a* by *b* – result always has the sign of *b*
| *a* `+` *b*            | 4           | Math     | Add *a* and *b*
| *a* `-` *b*            | 4           | Math     | Subtract *b* from *a*
| *a* `&` *b*            | 5           | String   | Concatenate strings *a* and *b*
| *a* `<` *b*            | 6           | Logic    | Return `true` if *a* is numerically less than *b*, else `false`
| *a* `<=` *b*           | 6           | Logic    | Return `true` if *a* is numerically less than or equal to *b*, else `false`
| *a* `>` *b*            | 6           | Logic    | Return `true` if *a* is numerically greater than *b*, else `false`
| *a* `>=` *b*           | 6           | Logic    | Return `true` if *a* is numerically greater than or equal to *b*, else `false`
| *a* `lt` *b*           | 6           | Logic    | Return `true` if *a* is alphanumerically less than *b*, else `false`
| *a* `le` *b*           | 6           | Logic    | Return `true` if *a* is alphanumerically less than or equal to *b*, else `false`
| *a* `gt` *b*           | 6           | Logic    | Return `true` if *a* is alphanumerically greater than *b*, else `false`
| *a* `ge` *b*           | 6           | Logic    | Return `true` if *a* is alphanumerically greater than or equal to *b*, else `false`
| *a* `==` *b*           | 7           | Logic    | Return `true` if *a* is numerically equal to *b*, else `false`
| *a* `!=` *b*           | 7           | Logic    | Return `true` if *a* is numerically unequal to *b*, else `false`
| *a* `eq` *b*           | 7           | Logic    | Return `true` if *a* is alphanumerically equal to *b*, else `false`
| *a* `ne` *b*           | 7           | Logic    | Return `true` if *a* is alphanumerically unequal to *b*, else `false`
| `not` *a*              | 8           | Logic    | Return `true` if *a* is `false`, or `false` if *a* is `true`
| *a* `and` *b*          | 9           | Logic    | Return `true` if *a* and *b* are both `true`, else `false`
| *a* `or` *b*           | 10          | Logic    | Return `true` if *a* or *b* or both are `true`, else `false`
| *list* `where` *expr*  | 11          | List     | For each *list* item in turn, set the special `...` variable to the item, evaluate *expr*, and return a list of all items for which the result of *expr* is true
| *list* `select` *expr* | 11          | List     | For each *list* item in turn, set the special `...` variable to the item, evaluate *expr*, and return a list of the results of *expr*
| *list* `order` *expr*  | 11          | List     | Order *list* such that *expr*, which is evaluated repeatedly with `...left` and `...right` set to pairs of list items, is `true` for all consecutive pairs of items – see below
| *a*`,` *b*`,` *c*...   | 12 (lowest) | List     | Make an ordered list of *a*, *b*, *c*, and more – also used for function arguments

If you want to calculate the square root of something, you can use the power-of operator with a fractional exponent: `val**(1/2)`

In the right-hand-side *expr* of the `where` and `select` operators, the special `...` variable (literally three dots – called the "anonymous variable" because, y'know, it has no name) is temporarily set to each *list* item in turn and then *expr* is evaluated, and then something is done with the result of evaluating *expr* depending on the operator. In *expr*, you can use the `...` variable wherever you'd use any other variable, and you can even simply write `...attrname` to do attribute lookups on the currently evaluated item:

| Line | Commands | Result
| ---- | -------- | ------
| 1    | _!mmm_ **set** odd_numbers = (1, 2, 3, 4, 5) **where** ... % 1 == 1 | odd_numbers = (1, 3, 5)
| 2    | _!mmm_ **set** nearly_dead = selected **where** ...HP < 5 | *(selected tokens with less than 5 HP)*
| 3    | _!mmm_ **set** my_tokens = selected **where** ...permission **eq** "control" | *(selected tokens that can be controlled by the player)*
| 4    | _!mmm_ **set** squares = (1, 2, 3, 4, 5) **select** ... ** 2 | squares = (1, 4, 9, 16, 25)
| 5    | _!mmm_ **set** pairs = (1, 2, 3) **select** (..., ...) | pairs = (1, 1, 2, 2, 3, 3)
| 6    | _!mmm_ **set** nearly_dead_HP = selected **select** ...HP **where** ... < 5 | nearly_dead_HP = (4, 1)
| 7    | _!mmm_ **set** nearly_dead_names = selected **where** ...HP < 5 **select** ...name | nearly_dead_names = ("Finn", "Yorric")

The list-sorting operator `order` evaluates its right-hand-side *expr* repeatedly for pairs of list items passed in `...left` and `...right` to define the comparison that shall be `true` for each pair of consecutive *list* items. (If the *expr* won't return `true` for a pair of items regardless of which one is `...left` and which one `...right`, the two items are considered equal and their order in the sorted list is arbitrary.)

If you have a primary sort key and a secondary one that decides the order only if the primary key is equal, you can specify both by having *expr* return a list that represents comparison results for the primary and the secondary key in turn – first list item the comparison result for the primary key, second for the secondary, and even more if there are more keys to compare.

| Line | Commands | Result
| ---- | -------- | ------
| 1    | _!mmm_ **set** sorted = (-2, -7, 2, 7, 5) **order** (...left < ...right) | sorted = (-7, -2, 2, 5, 7)
| 2    | _!mmm_ **set** reverse = (-2, -7, 2, 7, 5) **order** (...left > ...right) | reverse = (7, 5, 2, -2, -7)
| 3    | _!mmm_ **set** pairs = (foo: 456, foo: 123, bar: 123) **order** (...left.key **lt** ...right.key, ...left.value < ...right.value) | pairs = (bar: 123, foo: 123, foo: 456)

There are also three special debug operators: `?` *expr*, `??` *expr*, and `???` *expr*. They don't quite fit into the table above because they don't actually change the result of the expression they're used in. Instead, they just whisper a partial expression result back at you, and then continue evaluating the expression as if nothing happened.

| Syntax       | Precedence     | Category | Description
| ------------ | -------------- | -------- | -----------
| `?` *expr*   | higher than 1  | Debug    | Whisper the partial result of **as little as possible** from the following expression to the user – usually the very next literal, variable name, or function call
| `??` *expr*  | higher than 6  | Debug    | Whisper the partial result the following expression **up to the next comparison operator** to the user without changing evaluation order – can stop short of the next comparison operator if capturing more would change the order of operations
| `???` *expr* | very low            | Debug    | Whisper the partial result of **as much as possible** from the following expression to the user – can stop short of the end of the expression if capturing more would change the order of operations

A few examples will make it clearer – notice how the whispered message also highlights the partial expression whose result is shown:

| Line | Commands | What happens? | Explanation
| ---- | -------- | ------------- | -----------
| 1    | _!mmm_ **set** hit = `?` roll("1d20") + skill >= 20   | *(Whisper):*  `9` ◄ `? roll("1d20")` + skill >= 20 | *(just the roll result)*
| 2    | _!mmm_ **set** hit = roll("1d20") + `?` skill >= 20   | *(Whisper):*  `12` ◄ roll("1d20") + `? skill` >= 20 | *(just the skill variable)*
| 3    | _!mmm_ **set** hit = `??` roll("1d20") + skill >= 20  | *(Whisper):*  `21` ◄ `?? roll("1d20") + skill` >= 20 | *(everything up to the `>=` operator)*
| 4    | _!mmm_ **set** hit = `???` roll("1d20") + skill >= 20 | *(Whisper):*  `true` ◄ `??? roll("1d20") + skill >= 20` | *(everything)*
| 5    | _!mmm_ **set** result = 2 + `?` (3 * 4 + 5)           | *(Whisper):*  `17` ◄ 2 + `? (3 * 4 + 5)` | *(just the next parenthesized expression)*
| 6    | _!mmm_ **set** result = 2 + `?` 3 * 4 + 5             | *(Whisper):*  `3` ◄ 2 + `? 3` * 4 + 5 | *(just the next literal – kinda pointless here)*
| 7    | _!mmm_ **set** result = 2 + `???` 3 * 4 + 5           | *(Whisper):*  `12` ◄ 2 + `??? 3 * 4` + 5 | *(notice how `+ 5` cannot be included due to order of operations)*

This works in any place with an expression, of course, not just in **set** – you can use it in **if** and **do** and even inside of ${...} placeholders in **chat** commands. You can use multiple `?`-type operators in the same expression, too, and you'll get a separate whispered message back for each in evaluation order.


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
| highlight(*str*, *type*)                           | String    |  | ...with a colored outline depending on *type* = "normal", "important" (blue), "good" (green), "bad" (red), "info" (simple gray box)
| highlight(*str*, *type*, *tooltip*)                | String    |  | ...with a tooltip popping up on mouse hover
| highlight(*roll*, default, *tooltip*)              | String    | highlight(\[\[1d20]], default, "woo!") | ...with a colored outline depending on the roll result and a custom tooltip for the roll
| serialize(*value*)                                 | String    | serialize({x:1}) = "{x: 1}" | Convert any MMM value or data structure to a string containing the equivalent MMM expression literal
| deserialize(*string*)                              | String    | deserialize("{x: 1}") = {x:1} | Convert an MMM expression literal to the equivalent MMM value or data structure
| roll(*expr*)                                       | Roll      | roll("1d20+12") = 23 | Run a roll expression through Roll20's dice engine and return its result
| roll(*name\|id*, *expr*)                           | Roll      | roll("Finn", "@{HP}") = 15 | ...evaluated in context of character *name\|id* (instead of `sender`)
| iscritical(*roll*)                                 | Roll      |  | Return `true` if any die in the roll had its greatest value (e.g. 20 on 1d20), else `false`
| isfumble(*roll*)                                   | Roll      |  | Return `true` if any die in the roll had its smallest value (e.g. 1 on 1d20), else `false`
| distunits()                                        | Board     | distunits() = "m"    | Return name of distance units used on the current game board
| distscale()                                        | Board     | distscale() = 0.0714 | Return number of game board distance units per pixel
| distsnap()                                         | Board     | distsnap() = 70      | Return number of pixels between grid lines – if grid lines disabled, zero
| spawnfx(*type*, *left*, *top*)                     | Board     | spawnfx("nova-blood", 70, 70) | **[Side effect]** Spawns visual effect *type* around coordinates *left*, *top*
| spawnfx(*type*, *left1*, *top1*, *left2*, *top2*)  | Board     | | **[Side effect]** Spawns directional visual effect *type* going from coordinates *left1*, *top1* to coordinates *left2*, *top2*
| getpage()                                          | Board     | getpage() = "-MRZtlN_1XJe4k" | Return the page ID the calling player is currently viewing
| getpage(*playerid*)                                | Board     | | **\[Privileged]** Return the page ID the specified *playerid* is currently viewing
| showtracker()                                      | Tracker   | showtracker() = false | Return `true` if the turn tracker window is shown, else `false`
| showtracker(*shown*)                               | Tracker   | showtracker(true) | **\[Privileged]** **[Side effect]** Show or hide the turn tracker window
| gettracker()                                       | Tracker   | | Return list of entries in the turn tracker window – see below
| settracker(*entries*)                              | Tracker   | | **\[Privileged]** **[Side effect]** Update the turn tracker window to show all given *entries* – see below
| chat(*str*)                                        | Chat      | chat("Hi!") | **[Side effect]** Send string *str* to chat
| chat(*name\|id*, *str*)                            | Chat      | chat("Spiderbro", "Hi!") | **[Side effect]** Send string *str* to chat, impersonating another character or token under the player's control
| whisperback(*str*)                                 | Chat      | whisperback("Meh?") | **[Side effect]** Send string *str* only to the script sender's chat – useful for error messages
| delay(*seconds*)                                   | Script    | delay(0.5) | **[Side effect]** Wait *seconds* before continuing execution of the script
| findattr(*name\|id*)                               | Attribute | findattr("Finn") | List available character sheet table names – see below
| findattr(*name\|id*, *table*)                      | Attribute | findattr("Finn", "attack") | List available columns in a character sheet table – see below
| findattr(*name\|id*, *table*, *col*)               | Attribute | findattr("Finn", "attack", "weapon") | Find attribute name (or list of attribute names in `for` context) in a character sheet table – see below
| findattr(*name\|id*, *table*, *col*, *val*, *col*) | Attribute | findattr("Finn", "attack", "weapon", "Slingshot", "damage") | ...where another column matches a given value (multiple conditions allowed) – see below
| getcharid(*name\|id*)                              | Attribute | getcharid("Finn") | Return the character ID for *name\|id*
| getattr(*name\|id*, *attr*)                        | Attribute | getattr("Finn", "HP") | Look up attribute *attr* for *name\|id*
| getattrmax(*name\|id*, *attr*)                     | Attribute | getattrmax("Finn", "HP") | Look up maximum value of attribute *attr* for *name\|id*
| setattr(*name\|id*, *attr*, *val*)                 | Attribute | setattr("Finn", "HP", 17) | **[Side effect]** Set attribute *attr* for *name\|id* to *val*, then return *val* – create *attr* if necessary
| setattrmax(*name\|id*, *attr*, *val*)              | Attribute | setattrmax("Finn", "HP", 25) | **[Side effect]** Set maximum value of attribute *attr* for *name\|id* to *val* – create *attr* if necessary
| isdenied(*expr*)                                   | Attribute | isdenied(getattr("Finn", "HP")) | Return `true` if *expr* is a special `denied` indicator value (attribute access was denied), else `false`
| isdefault(*expr*)                                  | Customize | isdefault(default) | Return `true` if *expr* is the special `default` indicator value, else `false`
| isunknown(*expr*)                                  | Debug     | isunknown(result) | Return `true` if *expr* is a special `unknown` indicator result (the called function was unable to produce a meaningful result given its arguments and/or the current state of the game), else `false`
| getreason(*expr*)                                  | Debug     | getreason(result) = "Sunspots" | Return the diagnostic reason carried by a `denied` or `unknown` result

**Turn tracker:** Use the `gettracker()` function to get the list of turn tracker entries currently visible to the calling player (or GM), and the `settracker()` function (GMs only) to update the list.

The list returned by `gettracker()` is made up from structs describing each individual entries:

| Property        | Example            | Description
| --------------- | ------------------ | -----------
| `entry.title`   | `"Finn"`           | Title of the tracker entry (middle column)
| `entry.value`   | `"98"`             | Value of the tracker entry (right-hand column) – note that this is a string
| `entry.token`   |                    | Token ID if the tracker entry represents a token, or `unknown` if it's a custom entry
| `entry.page`    | `"-MRZtlN_1XJe4k"` | Page ID of the token represented by this tracker entry, or `undef` if it's a custom entry
| `entry.formula` | `"+1"`             | Formula (if any) applied by Roll20 when this entry becomes the first one after a turn

For GMs, `gettracker()` always returns all entries regardless of which page they're on, and it returns the most recently shown entries even if the turn tracker window is currently hidden. Regular players only get the entries they can actually see (custom entries and tokens on the current page) – and an empty list if the turn tracker window is hidden.

Only GMs can call the `settracker()` function. It takes a list of structs describing individual entries like above.

- For an entry that represents a token, set the `entry.token` property to the token ID or the name of a token or character on the board. The `entry.value` and `entry.formula` properties are supported but optional. The `entry.page` property is ignored and automatically set to the token's page ID. The `entry.title` page is also ignored and set to the token's name on the board.

- For a custom entry that's doesn't represent a token, set `entry.title` but leave `entry.token` undefined. The `entry.value` and `entry.formula` properties are supported but optional. The `entry.page` property is ignored.

Some useful examples:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **do** settracker() | *(clears the tracker)*
| 2    | _!mmm_ **do** settracker(selected select {token: ...}) | *(sets the tracker to the currently selected tokens)*
| 3    | _!mmm_ **do** settracker({title: "Round", value: 0, formula: "+1"}, gettracker()) | *(prepends a round counter to the current tracker contents)*
| 4    | _!mmm_ **do** settracker(gettracker() where not ...token) | *(removes all tokens from the tracker, but leaves all custom entries like a round counter)*
| 5    | _!mmm_ **do** settracker(gettracker() order ...left.title le ...right.title) | *(orders current tracker entries by title)*
| 6    | _!mmm_ **do** settracker(gettracker() order (...left.value > ...right.value, ...left.title le ...right.title)) | *(orders current tracker entries by value from greatest to least; or by title for entries with the same value)*


## Recipes

### Calling other API scripts

There are plenty of amazing API scripts around to satisfy your every need (or whim). You can call other API scripts from an MMM script to combine their powers.

To call another API script, just do what you'd do in person: Send a chat message with the API script command you want.

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **chat:** !Spawn --name\|Fireball --offset\|1,-1 | *(Calls [Spawn](https://app.roll20.net/forum/permalink/9649899/) to make a fireball appear next to the selected token)*

There's a wrinkle though: To properly support this, MMM must be loaded _before_ that other API script. Ask your GM to make sure that MMM appears earlier than the other API script you'd like to call from MMM in your game's list of API scripts. If that's not the case, the GM should delete and re-add the other script – that'll put it at the end of the list.

Why (if you're curious): To properly impersonate you to the other API script, MMM must manipulate the chat message it sent on your behalf to include your actual information (player ID and selected tokens). MMM can easily do this if it can get hands on the chat message before it reaches the other API script, which means that MMM's chat handler must be executed before the other API script's chat handler. Since chat handlers are executed in the same order API scripts were loaded, MMM must be loaded before the other API script.


### Using findattr() to determine character sheet attribute names

*Starting with MMM 1.27.0, the `findattr()` function has mostly become redundant thanks to the introduction of the `repeating` character property – see [Attributes](#attributes), above.*

The `findattr()` function helps you determine the attribute name to query (or update) anything that's in an extensible table in a character sheet.

These attribute names always start with `repeating_`... followed by a table name (e.g. `attack`), followed by a soup of random characters (the row ID), and finally the name of column you're interested in (e.g. `damage`). Official [Roll20 guidance](https://help.roll20.net/hc/en-us/articles/360037256794-Macros#Macros-ReferencingRepeatingAttributes) says to break out your HTML debugger and dive into the character sheet's HTML source to figure out these IDs – but that's a pants-on-fire–grade way to have to go about this.

With `findattr()` you can do all this without leaving the safe comfort of your chat box:

| Line | Commands | What happens?
| ---- | -------- | -------------
| 1    | _!mmm_ **chat:** Tables: ${findattr(sender)} | ***Finn:*** Tables: attack, defense, armor
| 2    | _!mmm_ **chat:** Columns: ${findattr(sender, "attack")} | ***Finn:*** Columns: weapon, skill, damage
| 3    | _!mmm_ **chat:** Attribute: ${findattr(sender, "attack", "weapon", "Slingshot", "damage")} | ***Finn:*** Attribute: repeating_attack_-MSxAHDgxtzAHdDAIopE_damage
| 4    | _!mmm_ **chat:** Value: ${sender.(findattr(sender, "attack", "weapon", "Slingshot", "damage"))} | ***Finn:*** Value: 1d6

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
| 4    | _!mmm_     **set** targetOffsetRight = targetToken.left - selectedToken.left | *(calculate horizontal offset of target from selected)*
| 5    | _!mmm_     **set** targetOffsetDown = targetToken.top - selectedToken.top | *(calculate vertical offset of target from selected)*
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

Never. But the cat might. I'll have to revoke his commit permission one of these days. (I don't have a cat.)


### Okay, so, I think I found a bug *the cat* made. How do I report it?

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
| 1    | _!mmm_ **chat:** Installed MMM version: ${version} | ***Finn:*** Installed MMM version: 1.19.1

If nothing is sent to chat at all after entering this command, MMM isn't installed in your game. Go pester your GM to get it done!

| Version | Date       | What's new?
| ------- | ---------- | -----------
| 1.29.9  | 2022-04-28 | Add `order` and string relation operators, `page` attribute, `getpage()`, and turn tracker functions
| 1.28.0  | 2022-04-03 | Add `serialize(val)` and `deserialize(str)` for data storage
| 1.27.0  | 2022-03-31 | Introduce structs, the `...` operator, and the `repeating` character property
| 1.26.0  | 2022-01-23 | Introduce `publish to sender` and `publish to game` commands
| 1.25.0  | 2022-01-20 | Introduce `!mmm-autorun` macros that auto-run on startup
| 1.24.0  | 2021-12-25 | Support `function` and `return` commands for custom functions
| 1.23.0  | 2021-12-16 | Introduce `where` and `select` operators and `...` variable
| 1.22.0  | 2021-12-15 | Add `delay(seconds)` to add delays in script execution
| 1.21.0  | 2021-12-15 | Support `chat` impersonation
| 1.20.0  | 2021-05-28 | Introduce `list[idx]` and `obj.prop` expression syntax
| 1.19.0  | 2021-05-07 | Add `for` loop and improve `findattr()` to return lists
| 1.18.0  | 2021-05-04 | Improve `highlight()` with `"info"` and `default` types
| 1.17.0  | 2021-04-18 | Add `spawnfx()` to spawn visual effects
| 1.16.0  | 2021-03-24 | Support `width` and `height` token attributes
| 1.15.0  | 2021-03-02 | Add diagnostic tooltips to `denied` and new `unknown` results
| 1.14.0  | 2021-02-22 | Introduce `debug chat`, `debug do`, and the `?` debug operators
| 1.13.0  | 2021-02-17 | Introduce `customize` block, `set customizable`, and `translate`
| 1.12.0  | 2021-02-10 | Add `isdenied(expr)` to check if `getattr()` access was denied
| 1.11.0  | 2021-02-07 | Support `status_`... attribute access to token status markers
| 1.10.0  | 2021-02-07 | Support optional *name\|id* parameter in `roll()` function
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
