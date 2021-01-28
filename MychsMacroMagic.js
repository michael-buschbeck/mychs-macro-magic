// Mych's Macro Magic by Michael Buschbeck <michael@buschbeck.net> (2021)
// https://github.com/michael-buschbeck/mychs-macro-magic/blob/main/LICENSE

const MMM_VERSION = "1.1.0";

on("chat:message", function(msg)
{
    var msgContext = new MychScriptContext();
    var msgContextUpdated = false;
    
    if (msg.type == "rollresult")
    {
        var msgRoll = JSON.parse(msg.content);
        msgContextUpdated = (msgContext.$consumeRolls([{ results: msgRoll }]) > 0);
    }
    else
    {
        msgContextUpdated = (msgContext.$consumeRolls(msg.inlinerolls) > 0);
    }

    var player = MychScriptContext.players[msg.playerid];

    if (!player)
    {
        player =
        {
            context: new MychScriptContext(),
            script: undefined,
            exception: undefined,
        };

        MychScriptContext.players[msg.playerid] = player;
    }

    if (msgContextUpdated)
    {
        player.context = msgContext;
    }

    player.context.sender = msg.who;
    player.context.playerid = msg.playerid;

    var scriptMatch = /^!mmm\s(.+)/.exec(msg.content);

    if (!scriptMatch)
    {
        return;
    }

    if (!player.script)
    {
        player.script = new MychScript(new MychScriptVariables());
    }

    try
    {
        var scriptCommand = scriptMatch[1];
        var scriptAdded = player.script.addCommand(scriptCommand, player.context);

        if (scriptAdded.type == "script")
        {
            player.script = scriptAdded;
        }

        if (player.script.complete)
        {
            if (!player.exception)
            {
                player.script.execute();
            }

            player.script = undefined;
            player.exception = undefined;
        }
    }
    catch (exception)
    {
        player.context.error(exception);

        if (player.script && player.script.complete)
        {
            player.script = undefined;
            player.exception = undefined;
        }
        else
        {
            player.exception = exception;
        }
    }
});

class MychScriptContext
{
    static players = {};

    version = MMM_VERSION;
    playerid = undefined;
    sender = undefined;

    floor(value)
    {
        return Math.floor(MychExpression.coerceNumber(value));
    }

    round(value)
    {
        return Math.round(MychExpression.coerceNumber(value));
    }

    ceil(value)
    {
        return Math.ceil(MychExpression.coerceNumber(value));
    }

    abs(value)
    {
        return Math.abs(MychExpression.coerceNumber(value));
    }

    len(value)
    {
        return MychExpression.coerceString(value).length;
    }

    min(varargs)
    {
        var minValue = undefined;

        for (var argIndex = 0; argIndex < arguments.length; ++argIndex)
        {
            var argValue = arguments[argIndex];
            
            if (argValue == undefined)
            {
                continue;
            }

            argValue = MychExpression.coerceNumber(argValue);

            if (minValue == undefined || minValue > argValue)
            {
                minValue = argValue;
            }
        }

        return minValue;
    }

    max(varargs)
    {
        var maxValue = undefined;

        for (var argIndex = 0; argIndex < arguments.length; ++argIndex)
        {
            var argValue = arguments[argIndex];
            
            if (argValue == undefined)
            {
                continue;
            }

            argValue = MychExpression.coerceNumber(argValue);
            
            if (maxValue == undefined || maxValue < argValue)
            {
                maxValue = argValue;
            }
        }

        return maxValue;
    }

    $consumeRolls(rolls)
    {
        if (!rolls || rolls.length == 0)
        {
            return 0;
        }

        var context = this;

        for (var rollIndex = 0; rollIndex < rolls.length; ++rollIndex)
        {
            var roll = Object.create(rolls[rollIndex]);
            
            roll.toScalar = function()
            {
                return this.results.total;
            };

            roll.toMarkup = function()
            {
                var criticalRoll = context.iscritical(this);
                var fumbledRoll = context.isfumble(this);

                var highlightType = (criticalRoll && fumbledRoll) ? "important" : criticalRoll ? "good" : fumbledRoll ? "bad" : "normal";

                return context.highlight(this, highlightType, this.expression ? ("Rolling " + this.expression) : undefined).toMarkup();
            };

            var rollReference = "$[[" + rollIndex + "]]";
            this[rollReference] = roll;
        }

        return rolls.length;
    }

    iscritical(roll)
    {
        try
        {
            return roll.results.rolls.some(die => die.sides && die.results && die.results.some(dieroll => dieroll.v == die.sides));
        }
        catch (exception)
        {
            return undefined;
        }
    }

    isfumble(roll)
    {
        try
        {
            return roll.results.rolls.some(die => die.sides && die.results && die.results.some(dieroll => dieroll.v == 1));
        }
        catch
        {
            return undefined;
        }
    }

    literal(value)
    {
        var replacements =
        {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&apos;",
        };

        return MychExpression.coerceString(value).replace(/[&<>"']/g, char => replacements[char]);
    }

    highlight(value, type = "normal", tooltip = undefined)
    {
        var result;
        
        if (value instanceof Object)
        {
            result = Object.create(value);
        }
        else
        {
            result = 
            {
                toScalar: function()
                {
                    return MychExpression.coerceScalar(value);
                },
            };
        }

        var styles =
        {
            "padding": "0 3px 0 3px",
            "color": "black",
            "background-color": "#FEF68E",
            "border": "2px solid #FEF68E",
            "font-weight": "bold",
            "font-size": "1.1em",
        };

        var borderStyleOverrides =
        {
            "good":      "2px solid #3FB315",
            "bad":       "2px solid #B31515",
            "important": "2px solid #4A57ED",
        };

        styles["border"] = borderStyleOverrides[MychExpression.coerceString(type)] || styles["border"];

        if (tooltip)
        {
            styles["cursor"] =  "help";
        }

        var valueLiteral = this.literal(value);
        var styleLiteral = this.literal(Object.entries(styles).map(styleEntry => styleEntry.join(":")).join(";"));

        if (!tooltip)
        {
            var classLiteral = this.literal("mmm-highlight mmm-highlight-" + type);

            result.toMarkup = function()
            {
                return "<span class=\"" + classLiteral + "\" style=\"" + styleLiteral + "\">" + valueLiteral + "</span>";
            }
        }
        else
        {
            var titleLiteral = this.literal(tooltip);
            var classLiteral = this.literal("mmm-highlight mmm-highlight-" + type + " showtip tipsy-n-right");

            result.toMarkup = function()
            {
                return "<span class=\"" + classLiteral + "\" title=\"" + titleLiteral + "\" style=\"" + styleLiteral + "\">" + valueLiteral + "</span>";
            };
        }

        return result;
    }

    chat(message)
    {
        var character = this.$getcharobj(this.sender);

        if (character)
        {
            sendChat("character|" + character.id, message);
            return;
        }
        
        if (this.playerid)
        {
            sendChat("player|" + this.playerid, message);
            return;
        }

        sendChat(this.sender || "Mych's Macro Magic", message);
    }

    error(exception)
    {
        log(exception.stack);
        sendChat("Mych's Macro Magic", "/direct " + exception, null, { noarchive: true });
    }

    $getcharobj(characterNameOrId)
    {
        if (/^-/.test(characterNameOrId))
        {
            var character = getObj("character", characterNameOrId);

            if (character)
            {
                return character;
            }
        }

        var characters = findObjs({ _type: "character", name: characterNameOrId });
        return characters[0];
    }
    
    $getattrobj(character, attributeName)
    {
        if (!character || character.get("_type") != "character")
        {
            return undefined;
        }

        var attributes = findObjs({ _type: "attribute", _characterid: character.id, name: attributeName });
        return attributes[0];
    }

    $createattrobj(character, attributeName)
    {
        if (!character || character.get("_type") != "character")
        {
            return undefined;
        }

        return createObj("attribute", { _characterid: character.id, name: attributeName });
    }

    getattr(characterNameOrId, attributeName)
    {
        var character = this.$getcharobj(characterNameOrId);

        if (attributeName == "character_id")
        {
            return character.id;
        }

        if (attributeName == "character_name")
        {
            return character.get("name");
        }

        var attribute = this.$getattrobj(character, attributeName);
        return attribute ? attribute.get("current") : undefined;
    }

    getattrmax(characterNameOrId, attributeName)
    {
        var character = this.$getcharobj(characterNameOrId0);
        var attribute = this.$getattrobj(character, attributeName);

        if (!attribute)
        {
            return undefined;
        }

        return attribute.get("max");
    }

    setattr(characterNameOrId, attributeName, attributeValue)
    {
        var character = this.$getcharobj(characterNameOrId);
        var attribute = this.$getattrobj(character, attributeName);

        if (!attribute)
        {
            attribute = this.$createattrobj(character, attributeName);
        }

        attribute.set("current", MychExpression.coerceScalar(attributeValue));

        return attribute.get("current");
    }

    setattrmax(characterNameOrId, attributeName, attributeValue)
    {
        var character = this.$getcharobj(characterNameOrId0);
        var attribute = this.$getattrobj(character, attributeName);

        if (!attribute)
        {
            attribute = this.$createattrobj(character, attributeName);
        }

        attribute.set("max", MychExpression.coerceScalar(attributeValue));

        return attribute.get("max");
    }
}

class MychScriptVariables
{
    // generic container
}

class MychScriptError
{
    constructor(stage, message, source, offset)
    {
        this.stage = stage;
        this.message = message;
        this.source = source;
        this.offset = offset;
    }

    toString()
    {
        return "During " + this.stage + ", " + this.message + " in script: " + this.source.substring(0, this.offset) + "\u274C" + this.source.substring(this.offset);
    }
}

class MychScript
{
    constructor(variables)
    {
        this.type = undefined;
        this.source = undefined;
        this.definition = {};
        this.variables = variables || {};
        this.nestedScripts = [];
        this.complete = false;
    }

    rethrowExpressionError(stage, exception, expressionOffset, source)
    {
        if (exception instanceof MychExpressionError)
        {
            throw new MychScriptError(stage, exception.message + " in expression", (source || this.source), expressionOffset + exception.offset);
        }

        throw new MychScriptError(stage, exception + " in expression", this.source, expressionOffset);
    }

    rethrowTemplateError(stage, exception, templateOffset)
    {
        if (exception instanceof MychTemplateError)
        {
            throw new MychScriptError(stage, exception.message + " in template", this.source, templateOffset + exception.offset);
        }

        throw new MychScriptError(stage, exception + " in template", this.source, templateOffset);
    }

    static commands =
    {
        script:
        {
            execute: function()
            {
                for (var nestedScript of this.nestedScripts)
                {
                    nestedScript.execute();
                }
            }
        },

        if:
        {
            tokens: [ /(?<expression>.+)/ ],

            parse: function(args)
            {
                var branch = { nestedScriptOffset: 0 };

                this.definition.branches = [branch];
                this.definition.branchElse = undefined;

                try
                {
                    this.definition.expressionOffset = args.expression.offset;
                    this.definition.expression = new MychExpression(args.expression.value);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                }
            },

            execute: function()
            {
                var elseBranch = this.definition.elseBranch;

                for (var branchIndex = 0; branchIndex < this.definition.branches.length; ++branchIndex)
                {
                    var branch = this.definition.branches[branchIndex];
                    var branchScript = (branchIndex == 0 ? this : this.nestedScripts[branch.nestedScriptOffset]);

                    var branchCondition;

                    try
                    {
                        branchCondition = branchScript.definition.expression.evaluate(this.variables, this.context);
                    }
                    catch (exception)
                    {
                        branchScript.rethrowExpressionError("execute", exception, branchScript.definition.expressionOffset);
                    }
    
                    if (MychExpression.coerceBoolean(branchCondition))
                    {
                        var nextBranch = this.definition.branches[branchIndex + 1] || elseBranch || { nestedScriptOffset: this.nestedScripts.length };

                        for (var nestedScript of this.nestedScripts.slice(branch.nestedScriptOffset, nextBranch.nestedScriptOffset))
                        {
                            nestedScript.execute();
                        }

                        return;
                    }
                }

                if (elseBranch)
                {
                    for (var nestedScript of this.nestedScripts.slice(elseBranch.nestedScriptOffset))
                    {
                        nestedScript.execute();
                    }
                }
            },
        },

        else:
        {
            tokens:
            {
                else:   [],
                elseif: [ "if", /(?<expression>.+)/ ],
            },

            parse: function(args, parentScripts)
            {
                var parentScript = parentScripts[parentScripts.length - 1];

                if (!parentScript || parentScript.type != "if")
                {
                    throw new MychScriptError("parse", "unexpected outside \"if\" block", this.source, 0);
                }

                if (args.expression)
                {
                    var branch = { nestedScriptOffset: parentScript.nestedScripts.length };

                    try
                    {
                        this.definition.expressionOffset = args.expression.offset;
                        this.definition.expression = new MychExpression(args.expression.value);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                    }

                    parentScript.definition.branches.push(branch);
                }
                else
                {
                    if (parentScript.definition.elseBranch)
                    {
                        throw new MychScriptError("parse", "unexpected after previous \"else\"", this.source, 0);
                    }

                    parentScript.definition.elseBranch = { nestedScriptOffset: parentScript.nestedScripts.length };
                }

                this.complete = true;
            },
        },

        set:
        {
            tokens: [ /(?<variable>\w+)/, "=", /(?<expression>.+)/ ],
            
            parse: function(args)
            {
                this.definition.variable = args.variable.value;

                try
                {
                    this.definition.expressionOffset = args.expression.offset;
                    this.definition.expression = new MychExpression(args.expression.value);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                }

                this.complete = true;
            },
            
            execute: function()
            {
                try
                {
                    this.variables[this.definition.variable] = this.definition.expression.evaluate(this.variables, this.context);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                }
            },
        },

        do:
        {
            tokens: [ /(?<expression>.+)/ ],

            parse: function(args)
            {
                try
                {
                    this.definition.expressionOffset = args.expression.offset;
                    this.definition.expression = new MychExpression(args.expression.value);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                }

                this.complete = true;
            },

            execute: function()
            {
                try
                {
                    this.definition.expression.evaluate(this.variables, this.context);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                }
            },
        },

        chat:
        {
            tokens: [ ":", /(?<template>.+)/ ],

            parse: function(args)
            {
                try
                {
                    this.definition.templateOffset = args.template.offset;
                    this.definition.template = new MychTemplate(args.template.value);
                }
                catch (exception)
                {
                    this.rethrowTemplateError("parse", exception, this.definition.templateOffset);
                }

                this.complete = true;
            },

            execute: function()
            {
                var message;

                try
                {
                    message = this.definition.template.evaluate(this.variables, this.context);
                }
                catch (exception)
                {
                    this.rethrowTemplateError("execute", exception, this.definition.templateOffset);
                }

                if (this.variables.chat)
                {
                    this.variables.chat(message);
                }
                else
                {
                    this.context.chat(message);
                }
            },
        },

        combine:
        {
            tokens:
            {
                chat:    [ "chat" ],
                chatsep: [ "chat", "using", /(?<expression>.+)/ ],
            },

            parse: function(args)
            {
                if (args.expression)
                {
                    try
                    {
                        this.definition.expressionOffset = args.expression.offset;
                        this.definition.expression = new MychExpression(args.expression.value);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                    }
                }
            },

            execute: function()
            {
                var separator = " ";

                if (this.definition.expression)
                {
                    try
                    {
                        separator = this.definition.expression.evaluate(this.variables, this.context);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                    }
                }

                var messages = [];
                var prevChat = this.variables.chat;

                try
                {
                    this.variables.chat = function(message)
                    {
                        messages.push(message);
                    };

                    for (var nestedScript of this.nestedScripts)
                    {
                        nestedScript.execute();
                    }
                }
                finally
                {
                    this.variables.chat = prevChat;
                }

                if (this.variables.chat)
                {
                    this.variables.chat(messages.join(separator));
                }
                else
                {
                    this.context.chat(messages.join(separator));
                }
            },
        },
    };

    static parseTokens(tokenPatterns, source, sourceOffset)
    {
        var args = {};

        var whitespaceRegExp = /\s*/g;

        for (var tokenPattern of tokenPatterns)
        {
            whitespaceRegExp.lastIndex = sourceOffset;
            var whitespaceMatch = whitespaceRegExp.exec(source);

            if (!whitespaceMatch || whitespaceMatch.index != sourceOffset)
            {
                return [sourceOffset, undefined];
            }

            sourceOffset = whitespaceMatch.index + whitespaceMatch[0].length;

            var tokenRegExpSource;

            if (tokenPattern instanceof RegExp)
            {
                tokenRegExpSource = tokenPattern.source;
            }
            else
            {
                tokenRegExpSource = tokenPattern;
                tokenRegExpSource = tokenRegExpSource.replace(/(\W)/g, "\\$1");
                tokenRegExpSource = tokenRegExpSource.replace(/^\b|\b$/g, "\\b");
            }
            
            var tokenRegExp = new RegExp(tokenRegExpSource, "ig");

            tokenRegExp.lastIndex = sourceOffset;
            var tokenMatch = tokenRegExp.exec(source);

            if (!tokenMatch || tokenMatch.index != sourceOffset)
            {
                return [sourceOffset, undefined];
            }

            if (tokenMatch.groups)
            {
                for (var [argName, argValue] of Object.entries(tokenMatch.groups))
                {
                    if (argValue != undefined)
                    {
                        args[argName] = { offset: sourceOffset, value: argValue };
                    }
                }
            }

            sourceOffset = tokenMatch.index + tokenMatch[0].length;
        }

        whitespaceRegExp.lastIndex = sourceOffset;
        var whitespaceMatch = whitespaceRegExp.exec(source);

        if (!whitespaceMatch || whitespaceMatch.index != sourceOffset)
        {
            return [sourceOffset, undefined];
        }

        sourceOffset = whitespaceMatch.index + whitespaceMatch[0].length;

        return [sourceOffset, args];
    }

    static parseCommand(source)
    {
        for (var commandType in MychScript.commands)
        {
            var [sourceOffset, commandTypeArgs] = MychScript.parseTokens([commandType], source, 0);

            if (!commandTypeArgs)
            {
                continue;
            }

            var command = MychScript.commands[commandType];

            if (command.tokens)
            {
                var commandTokensAlternatives = (command.tokens instanceof Array ? [command.tokens] : Object.values(command.tokens));
                var maxSourceOffsetAlternative = sourceOffset;

                for (var commandTokens of commandTokensAlternatives)
                {
                    var [sourceOffsetAlternative, commandArgs] = MychScript.parseTokens(commandTokens, source, sourceOffset);

                    if (sourceOffsetAlternative == source.length && commandArgs)
                    {
                        return [commandType, commandArgs];
                    }

                    if (sourceOffsetAlternative > maxSourceOffsetAlternative)
                    {
                        maxSourceOffsetAlternative = sourceOffsetAlternative;
                    }
                }

                throw new MychScriptError("parse", "syntax error", source, maxSourceOffsetAlternative);
            }
            else
            {
                if (sourceOffset == source.length)
                {
                    return [commandType, {}];
                }

                throw new MychScriptError("parse", "syntax error", source, sourceOffset);
            }
        }

        var [sourceOffset] = MychScript.parseTokens([], source, 0);

        throw new MychScriptError("parse", "unknown command", source, sourceOffset);
    }

    addCommand(source, context, parentScripts = [])
    {
        if (this.complete)
        {
            throw new MychScriptError("parse", "unexpected command", source, 0);
        }

        if (!this.type)
        {
            var [commandType, commandArgs] = MychScript.parseCommand(source);

            var command = MychScript.commands[commandType];

            this.type = commandType;
            this.source = source;
            this.context = context;

            if (command.parse)
            {
                command.parse.call(this, commandArgs, parentScripts || []);
            }

            this.execute = (command.execute || function() {});
        
            return this;
        }
        else
        {
            var nestedScript = this.nestedScripts[this.nestedScripts.length - 1];

            if (nestedScript && !nestedScript.complete)
            {
                return nestedScript.addCommand(source, context, parentScripts.concat(this));
            }

            var [endSourceOffset, endCommandArgs] = MychScript.parseTokens([ "end", /(?<type>\w+)/ ], source, 0);

            if (endCommandArgs)
            {
                if (endSourceOffset != source.length)
                {
                    throw new MychScriptError("parse", "syntax error", source, endSourceOffset);
                }

                if (endCommandArgs.type.value != this.type)
                {
                    var endParentScriptIndex = parentScripts.map(script => script.type).lastIndexOf(endCommandArgs.type.value);

                    if (endParentScriptIndex >= 0)
                    {
                        for (var parentScript of parentScripts.slice(endParentScriptIndex))
                        {
                            parentScript.complete = true;
                        }
                    }

                    throw new MychScriptError("parse", "unexpected block end", source, endCommandArgs.type.offset);
                }

                this.complete = true;

                return this;
            }

            nestedScript = new MychScript(this.variables);
            nestedScript.addCommand(source, context, parentScripts.concat(this));
        
            this.nestedScripts.push(nestedScript);

            return nestedScript;
        }
    }
}

class MychTemplateError
{
    constructor(stage, message, source, offset)
    {
        this.stage = stage;
        this.message = message;
        this.source = source;
        this.offset = offset;
    }

    toString()
    {
        return "During " + this.stage + ", " + this.message + " in template: " + this.source.substring(0, this.offset) + "\u274C" + this.source.substring(this.offset);
    }
}

class MychTemplate
{
    constructor(source)
    {
        this.source = undefined;
        this.segments = [];

        if (source != undefined)
        {
            this.parse(source);
        }
    }

    rethrowExpressionError(stage, exception, expressionOffset)
    {
        if (exception instanceof MychExpressionError)
        {
            throw new MychTemplateError(stage, exception.message + " in expression", this.source, expressionOffset + exception.offset);
        }

        throw new MychTemplateError(stage, exception + " in expression", this.source, expressionOffset);
    }

    parse(source)
    {
        var segments = [];
        var segmentRegExp = /(?<string>([^\\$]|\\.|\$(?!\{))+)|\$\{(?<expression>([^}"']|"([^\\"]|\\.)*"|'([^\\']|\\.)*')*)\}/g;
        var segmentMatch;

        var segmentOffset = 0;

        while (segmentMatch = segmentRegExp.exec(source))
        {
            if (segmentMatch.index != segmentOffset)
            {
                throw new MychTemplateError("parse", "syntax error", source, segmentOffset);
            }

            if (segmentMatch.groups.string)
            {
                var unescapedString = segmentMatch.groups.string.replace(/\\(.)/g, "$1");
                segments.push({ type: "string", offset: segmentOffset, value: unescapedString });
            }

            if (segmentMatch.groups.expression)
            {
                var expressionOffset = segmentOffset + "${".length;
                try
                {
                    var expression = new MychExpression(segmentMatch.groups.expression);
                    segments.push({ type: "expression", offset: expressionOffset, expression: expression });
                }
                catch (exception)
                {
                    this.rethrowExpressionError("parse", exception, expressionOffset);
                }
            }

            segmentOffset = segmentMatch.index + segmentMatch[0].length;
        }

        if (segmentOffset != source.length)
        {
            throw new MychTemplateError("parse", "syntax error", source, segmentOffset);
        }

        this.segments = segments;
    }

    evaluate(variables, context)
    {
        var contextKeys = Object.keys(context);
        var contextKeysRegExp;

        if (contextKeys.length > 0)
        {
            contextKeysRegExp = new RegExp(contextKeys.map(key => key.replace(/(\W)/g, "\\$1").replace(/^\b|\b$/, "\\b")).join("|"), "g");
        }

        var evaluatedSegments = [];

        for (var segment of this.segments)
        {
            switch (segment.type)
            {
                case "string":
                {
                    var evaluatedString = segment.value;

                    if (contextKeysRegExp)
                    {
                        evaluatedString = evaluatedString.replace(contextKeysRegExp,
                            function(key) { return MychExpression.coerceMarkup(context[key]) });
                    }

                    evaluatedSegments.push(evaluatedString);
                }
                break;

                case "expression":
                {
                    try
                    {
                        var expressionValue = segment.expression.evaluate(variables, context);
                        evaluatedSegments.push(MychExpression.coerceMarkup(expressionValue));
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("evaluate", exception, segment.offset);
                    }
                }
                break;
            }
        }
    
        return evaluatedSegments.join("");
    }
}

class MychExpressionError
{
    constructor(stage, message, source, offset)
    {
        this.stage = stage;
        this.message = message;
        this.source = source;
        this.offset = offset;
    }

    toString()
    {
        return "During " + this.stage + ", " + this.message + " in expression: " + this.source.substring(0, this.offset) + "\u274C" + this.source.substring(this.offset);
    }
}

class MychExpressionArgs extends Array
{
    // marker subclass for comma-separated argument lists in expressions
}

class MychExpression
{
    constructor(source)
    {
        this.source = undefined;
        this.tokens = [];
    
        if (source != undefined)
        {
            this.parse(source);
        }
    }

    static coerceScalar(value)
    {
        if (value instanceof Array)
        {
            return value[value.length - 1];
        }

        if (value && value.toScalar instanceof Function)
        {
            return value.toScalar();
        }

        return value;
    }

    static coerceMarkup(value)
    {
        if (value && value.toMarkup instanceof Function)
        {
            return value.toMarkup();
        }

        return MychExpression.coerceString(value);
    }

    static coerceString(value)
    {
        value = MychExpression.coerceScalar(value);

        if (value == undefined || value == null)
        {
            return "";
        }

        return String(value);
    }

    static coerceNumber(value)
    {
        value = MychExpression.coerceScalar(value);

        switch (typeof(value))
        {
            case "number":
            {
                return value;
            }

            case "boolean":
            {
                return (value ? 1 : 0);
            }

            case "string": 
            {
                value = parseFloat(value);
                return (isNaN(value) ? 0 : value);
            }
        }

        return 0;
    }

    static coerceBoolean(value)
    {
        value = MychExpression.coerceScalar(value);

        switch (typeof(value))
        {
            case "boolean":
            {
                return value;
            }

            case "number":
            {
                return (value != 0);
            }

            case "string": 
            {
                return (string.length > 0);
            }
        }

        return 0;
    }

    static coerceArgs(value)
    {
        if (value instanceof MychExpressionArgs)
        {
            return value;
        }

        return MychExpressionArgs.of(value);
    }

    static operators =
    {
        "**": {
            binary: { precedence: 1, execute: (a,b) => MychExpression.coerceNumber(a) ** MychExpression.coerceNumber(b), associativity: "right" }
        },
        "*": {
            binary: { precedence: 3, execute: (a,b) => MychExpression.coerceNumber(a) * MychExpression.coerceNumber(b) }
        },
        "/": {
            binary: { precedence: 3, execute: (a,b) => MychExpression.coerceNumber(a) / MychExpression.coerceNumber(b) }
        },
        "%": {
            binary: { precedence: 3, execute: (a,b) => MychExpression.coerceNumber(a) % MychExpression.coerceNumber(b) }
        },
        "+": {
            unary:  { precedence: 2, execute: (a) => a },
            binary: { precedence: 4, execute: (a,b) => MychExpression.coerceNumber(a) + MychExpression.coerceNumber(b) }
        },
        "-": {
            unary:  { precedence: 2, execute: (a) => -MychExpression.coerceNumber(a) },
            binary: { precedence: 4, execute: (a,b) => MychExpression.coerceNumber(a) - MychExpression.coerceNumber(b) }
        },
        "<": {
            binary: { precedence: 5, execute: (a,b) => MychExpression.coerceNumber(a) < MychExpression.coerceNumber(b) }
        },
        "<=": {
            binary: { precedence: 5, execute: (a,b) => MychExpression.coerceNumber(a) <= MychExpression.coerceNumber(b) }
        },
        ">": {
            binary: { precedence: 5, execute: (a,b) => MychExpression.coerceNumber(a) > MychExpression.coerceNumber(b) }
        },
        ">=": {
            binary: { precedence: 5, execute: (a,b) => MychExpression.coerceNumber(a) >= MychExpression.coerceNumber(b) }
        },
        "==": {
            binary: { precedence: 6, execute: (a,b) => MychExpression.coerceNumber(a) == MychExpression.coerceNumber(b) }
        },
        "!=": {
            binary: { precedence: 6, execute: (a,b) => MychExpression.coerceNumber(a) != MychExpression.coerceNumber(b) }
        },
        "eq": {
            binary: { precedence: 6, execute: (a,b) => MychExpression.coerceString(a) == MychExpression.coerceString(b) }
        },
        "ne": {
            binary: { precedence: 6, execute: (a,b) => MychExpression.coerceString(a) != MychExpression.coerceString(b) }
        },
        "and": {
            binary: { precedence: 7, execute: (a,b) => MychExpression.coerceBoolean(a) && MychExpression.coerceBoolean(b) }
        },
        "or": {
            binary: { precedence: 8, execute: (a,b) => MychExpression.coerceBoolean(a) || MychExpression.coerceBoolean(b) }
        },
        "not": {
            unary:  { precedence: 9, execute: (a) => !MychExpression.coerceBoolean(a) },
        },
        ",": {
            binary: { precedence: 10, execute: (a,b) => MychExpression.coerceArgs(a).concat(MychExpression.coerceArgs(b)) }
        },
    };

    static createTokenRegExp()
    {
        var compareLengthDecreasing = function(string1, string2)
        {
            // Sort in decreasing order of string length.
            return (string2.length - string1.length);
        };

        var createOperatorRegExpSource = function(operator)
        {
            // Escape all characters that might have special meaning and add boundary assertions.
            return operator.replace(/(\W)/g, "\\$1").replace(/^\b|\b$/g, "\\b");
        };

        var operatorRegExpSource = Object.keys(MychExpression.operators).sort(compareLengthDecreasing).map(createOperatorRegExpSource).join("|");

        var tokenPatterns =
        {
            operator:             operatorRegExpSource,
            literalNumber:        /(\.\d+|\d+(\.\d*)?)([eE][-+]?\d+)?/,
            literalBoolean:       /\b(true|false)\b/,
            literalStringDouble:  /"([^"\\]|\\.)*"?/,
            literalStringSingle:  /'([^'\\]|\\.)*'?/,
            identifier:           /\b\w+\b|\$\[\[\w+\]\]/,
            parenthesis:          /[()]/,
            whitespace:           /\s+/,
            unsupported:          /.+/,
        }

        var createTokenRegExpSource = function([type, pattern])
        {
            if (pattern instanceof RegExp)
            {
                pattern = pattern.source;
            }

            return "(?<" + type + ">" + pattern + ")";
        };

        return new RegExp(Object.entries(tokenPatterns).map(createTokenRegExpSource).join("|"), "g");
    }

    static tokenRegExp = MychExpression.createTokenRegExp();

    parse(source)
    {
        var tokens = [];
        var tokenMatch;

        MychExpression.tokenRegExp.lastIndex = 0;

        while (tokenMatch = MychExpression.tokenRegExp.exec(source))
        {
            if (tokenMatch.groups.whitespace)
            {
                continue;
            }

            if (tokenMatch.groups.unsupported)
            {
                throw new MychExpressionError("parse", "syntax error", source, tokenMatch.index);
            }

            var [tokenType, tokenValue] = Object.entries(tokenMatch.groups).find(([type, value]) => value);

            switch (tokenType)
            {
                case "literalNumber":
                {
                    tokenType = "literal";
                    tokenValue = parseFloat(tokenValue);
                }
                break;

                case "literalBoolean":
                {
                    tokenType = "literal";
                    tokenValue = (tokenValue == "true");
                }
                break;

                case "literalStringDouble":
                {
                    tokenType = "literal";
                    tokenValue = tokenValue.replace(/^"|"$/g, "").replace(/\\(.)/g, "$1");
                }
                break;

                case "literalStringSingle":
                {
                    tokenType = "literal";
                    tokenValue = tokenValue.replace(/^'|'$/g, "").replace(/\\(.)/g, "$1");
                }
                break;
            }

            tokens.push({ type: tokenType, offset: tokenMatch.index, value: tokenValue });
        }

        this.source = source;
        this.tokens = tokens;
    }

    evaluate(variables, context)
    {
        var valueStack = [];
        var operationStack = [];

        var reduce = function(precedence)
        {
            while (operationStack.length > 0)
            {
                var operation = operationStack[operationStack.length - 1];

                if (operation.type == "parenthesis")
                {
                    break;
                }

                if (precedence != undefined && operation.precedence > precedence)
                {
                    break;
                }

                operationStack.pop();

                var executionArguments = valueStack.splice(-operation.operands);
                var executionResult;

                if (operation.type == "function")
                {
                    executionArguments = executionArguments.flat(1);
                    executionResult = operation.execute.apply(operation.context, executionArguments);
                }
                else
                {
                    executionResult = operation.execute.apply(this, executionArguments);
                }

                valueStack.push(executionResult);
            }
        };

        var expectClosing = [{}];
        var expectTokens = { operator: "unary", literal: "any", identifier: "any", parenthesis: "opening" };

        var getExpectDescription = function()
        {
            return Object.entries(expectTokens).filter(([type, qualifier]) => qualifier).map(([type, qualifier]) => qualifier + " " + type).join(", ");
        };

        for (var token of this.tokens)
        {
            var tokenQualifier = "any";
            var expectTokenQualifiers = [expectTokens[token.type]].flat();

            var operator = undefined;

            switch (token.type)
            {
                case "operator":
                {
                    var operatorVariants = MychExpression.operators[token.value];
                    var operatorType = expectTokenQualifiers.find(qualifier => operatorVariants[qualifier]);
                    operator = operatorVariants[operatorType];
                    tokenQualifier = operatorType || Object.keys(operatorVariants).join("/");
                }
                break;

                case "parenthesis":
                {
                    tokenQualifier = (token.value == "(" ? "opening" : "closing");
                }
                break;
            }

            if (!expectTokenQualifiers.includes(tokenQualifier))
            {
                var expectDescription = getExpectDescription();
                throw new MychExpressionError("evaluate", tokenQualifier + " " + token.type + " not expected here (expected " + expectDescription + ")", this.source, token.offset);
            }

            switch (token.type)
            {
                case "operator":
                {
                    if (tokenQualifier == "unary")
                    {
                        operationStack.push({ type: "operator", name: token.value, operands: 1, precedence: operator.precedence, execute: operator.execute });
                        expectTokens = { operator: "unary", literal: "any", identifier: "any", parenthesis: "opening" };
                    }
                    else
                    {
                        reduce(operator.associativity == "right" ? operator.precedence - 1 : operator.precedence);

                        operationStack.push({ type: "operator", name: token.value, operands: 2, precedence: operator.precedence, execute: operator.execute });
                        expectTokens = { operator: "unary", literal: "any", identifier: "any", parenthesis: "opening" };
                    }
                }
                break;
                
                case "literal":
                {
                    valueStack.push(token.value);
                    expectTokens = { operator: "binary", parenthesis: expectClosing[0].parenthesis };
                }
                break;

                case "identifier":
                {
                    var identifierContext = variables;
                    var identifierValue = variables[token.value];

                    if (identifierValue == undefined)
                    {
                        identifierContext = context;
                        identifierValue = context[token.value];
                    }

                    if (identifierValue instanceof Function)
                    {
                        operationStack.push({ type: "function", name: token.value, operands: 1, precedence: 0, execute: identifierValue, context: identifierContext });
                        expectTokens = { parenthesis: "opening" };
                    }
                    else
                    {
                        valueStack.push(identifierValue);
                        expectTokens = { operator: "binary", parenthesis: expectClosing[0].parenthesis };
                    }
                }
                break;

                case "parenthesis":
                {
                    if (token.value == "(")
                    {
                        operationStack.push({ type: "parenthesis", valueStackOffset: valueStack.length });
                        expectClosing.unshift({ parenthesis: "closing" });
                        expectTokens = { operator: "unary", literal: "any", identifier: "any", parenthesis: ["opening", "closing"] };
                    }
                    else
                    {
                        reduce();

                        var openingParenthesisOperation = operationStack.pop();
                        if (valueStack.length == openingParenthesisOperation.valueStackOffset)
                        {
                            valueStack.push([]);
                        }

                        expectClosing.shift();
                        expectTokens = { operator: "binary", parenthesis: expectClosing[0].parenthesis };
                    }
                }
                break;
            }
        }

        if (expectTokens.operator != "binary")
        {
            var expectDescription = getExpectDescription();
            throw new MychExpressionError("evaluate", "expected " + expectDescription, this.source, this.source.length);
        }

        reduce();

        if (operationStack.length != 0)
        {
            var expectDescription = getExpectDescription();
            throw new MychExpressionError("evaluate", "expected " + expectDescription, this.source, this.source.length);
        }

        var result = MychExpression.coerceScalar(valueStack);

        if (result instanceof MychExpressionArgs)
        {
            result = Array.of.apply(null, result);
        }

        return result;
    }
}
