# FLApp — XML Format — Introduction

> Readable Markdown conversion of the original `JaFL-XML-Intro.html`
> (by Jonathan Mann, the FLApp author). The `.html` file remains the
> authoritative reference; this is a convenience copy for reading.

A few brave souls have asked about the format used by FLApp to encode the
books, out of curiosity or because they want to create their own content. In
this and in the accompanying [tag list](JaFL-XML-Tags.md) is a fairly complete
dump of the necessaries. If something is unclear or missing, tell me about it
and I'll attempt to clarify. Good luck!

To begin: you'll want a text editor with some sort of support for XML
formatting. I use Vim, which provides me with syntax highlighting and
indenting; there are probably (definitely) other, better, editors for this
purpose. Someone with more skill in macros and templates may be able to create
a more appropriate environment for writing in this format, but it won't be me.

Maybe this would be easiest if I describe how I go about converting a section
from one of the available *Fabled Lands* books.

## XML

First off, I create a file for that particular section, named
***\<section number\>*.xml**, in the book directory that the section belongs to
(I'll get to that). Each visible document is in its own file — every section, as
well as each playable character description and the (readable) rules.

Next, I copy and paste the text for that section from the PDF. Add a
`<section>` tag at the beginning, with the **name** attribute giving the section
number (as displayed at the top of the page). General HTML rules apply here —
extra whitespace (spaces, tabs) and new lines are ignored. To break the text
into paragraphs, use the `<p>` tag at the start of each paragraph (and the
matching close tag, `</p>`, at the end). If there is only one paragraph (besides
the list of choices or outcomes at the end) you can leave these out.

Oh yes, this is XML, not HTML. You can get away with badly formatted HTML, but
XML is less forgiving. Every start tag (`<tagname attributes>`) must be matched
by an end tag (`</tagname>`). Empty tags are indicated by a slash at the end of
the tag, eg. `<tagname attributes />`. So when I mentioned the `<section>` tag
before, it goes without saying that the file also needs to end with the matching
tag, `</section>`. Attributes can be supplied in start tags and empty tags, and
are of the form `attributeName="attribute value"`.

## Actions

Within the section you'll need to identify 'actions' — the things that are
generally underlined and can be clicked on (if not greyed out). These are
indicated by enclosing the action text within the appropriate tags,
`<tagname attributes>action text</tagname>`. There are various action types
available, each with their own attributes that will make the action even more
specific. For example, the most common is probably the `<goto>` tag. The most
common form of this is

```xml
<goto section="I"/>
```

which will produce the action "turn to **I**". Notice here that I used an empty
tag, without any action text. Most of the tags have their own default text which
will get used in this case; this can vary depending on the attributes present.
This default text will start with a leading capital, if the program thinks a new
sentence is required. To provide action text, do the following eg.

```xml
<goto section="J">return to J</goto>
```

which will produce the action "return to **J**". Notice that the section number
is bold here; this is one of those automatic conversions that the program does,
and which I'll try to remember to document. In the same way, codewords can be
automatically italicised, and items automatically displayed in bold. Also, an
ability name given in uppercase will be automatically formatted. To supply your
own style to the text, the standard tags `<b>`, `<i>` and `<u>` can be used (to
indicate bold, italics, and underlined text respectively). These can be used
within the action text as well as within the regular text (though not in
attribute values).

When the section is 'read' by the player, these actions are generally activated
sequentially. If an action would have no effect, or can't be activated by the
player, it generally stays disabled (greyed out) and execution continues to the
next action; otherwise, the action 'blocks' the program until it has been
activated. There are exceptions all over the place — eg. the `<item>` action,
which defines an item that the character can pick up, is generally enabled (if
the character has room to pick it up) but doesn't block. The 'blocking' behaviour
can be specified by using the **force** attribute in the action, with a value of
"**true**" or "**false**" (or "**T**" or "**F**"). For example, the action
`<tick shards="100" force="t"/>` will create the action "100 Shards" and block
further execution until it has been clicked on.

Which actions get 'reached' can be changed by using the `<if>`, `<elseif>` and
`<else>` tags, which will be familiar to any programmers. If the conditions
defined by the `<if>` attributes are met, then the actions within that block
will be activated in turn. Otherwise the text and actions within the `<if>`
block remain greyed out. The `<elseif>` and `<else>` tags can be used after an
`<if>` block, and are activated if the conditions of the `<if>` are not met (and
their own conditions are). These tags can also be nested, although the program
gets confused if the `<else>` and `<elseif>`s are used at different nesting
'levels' in close proximity. This explanation is probably less useful than just
poking about in one of the files for examples.

Many sections will end with a series of choices (a description and the section
destination), or outcomes (a range of dice results and the section destination).
Outcomes are more difficult and may illustrate some other features, so I'll
describe them. To start with, a set of outcomes need to be grouped with the
`<outcomes>` tag. Then each possible outcome is given by a separate `<outcome>`
tag, which supplies a **range** attribute (giving the range of dice results it
will match), a **section** to turn to (and possibly a **book** as well), and
possibly a description (between the start and end tags). The description can
actually include actions (eg. `<lose stamina="1d">1-6 Stamina</lose>`), which
will need to be clicked by the player before the destination is enabled. In
fact, the **section** can be left out entirely.

Outcomes can also be used like `<if>` tags, containing some amount of text and
actions which can only be activated if the outcome is matched.

## Variables

Now, the dice result that the outcomes work on are generated elsewhere, usually
by a `<random dice="I"/>` action. When activated, this action will simulate
rolling a number of dice, storing the result into a *variable*. Variables can be
kept with each section, and are only kept while that section is the current one.
To specify the name of the variable, the **var** attribute can be used (here and
in various tags). If it's missing, an 'anonymous' variable is used. Most sections
won't need more than one variable, and in these cases you can leave out the
**var** attribute. So after the dice result is stored in a variable, the
`<outcome>` actions are reached; each of them checks the value of the variable
for a match with their own range. Variables can be used for other purposes,
holding the results of calculations, and to compare against in `if` blocks.

To store a value directly into a variable, there's the `<set>` tag. This can be
hidden in the text, being automatically activated when it's reached.
Alternatively, it can be used like any normal action if some action text is
supplied. Generally it's used with the **var** and **value** attributes, the
latter supplying the value to be stored in the variable. This value can actually
be in the form of an expression — ie. using plus (+), minus (-), divide (/),
multiply (*) and parentheses ('(' and ')'). As operands within the expression,
you can use a variable name, an ability, 'stamina', 'shards', or a few other
possibilities. This has made it rather useful for when the authors come up with
another unique test or calculation. A more common usage is shown by this
example, book 1, 275:

```xml
<if god="Alvir and Valmir"><set var="cost" value="5"/></if>
<else><set var="cost" value="20"/></else>
```

<!-- Note: the original HTML wrote the second tag as `<setvar="cost" ...>`
     (a typo, missing space); corrected to `<set var="cost" ...>` here. -->

This determines the price for a blessing paid for later in the section, where
the variable is referenced directly by **shards="cost"**.

## Codewords

Codewords should be familiar — the set of words kept by the player to track
which quests they've done, who they've annoyed, etc. Within the program
codewords have a more general use as variables that are maintained between
sections. A codeword is 'set' if it holds a value other than 0 (usually 1); a
codeword is 'missing' if it equals 0 or is absent. Ticked boxes are also recorded
as codewords, with the number of ticks stored under the name *book* # `/` *section
#*. Thus, 2 ticks at section 10 in book 1 is recorded as '1/10=2'. Similarly, the
ticks recorded by a 'town-house' option are stored as codewords. It's quite easy
to use codewords to track the progress of the character, though it's advisable to
make codewords fairly unique (eg. by including the book and section number),
since once created they continue to exist across all books. For example, in book
5 your status at court is kept by the codeword 'UttakuStatus'.

## Items

There are four basic item types used within the program: weapon, tool, armour
and item. A weapon is anything that can be wielded, and usually gives a Combat
bonus. Armour is any item which can be worn, giving a Defence bonus. A tool is an
item that gives a bonus to one of the six abilities (excluding Combat); the tool
that gives the best bonus for a particular ability is automatically used. An item
is anything else (for the programmers out there, Item is the superclass of Weapon
and Armour; Weapon is the superclass of Tool).

To include an item that the character can pick up, buy or sell, a tag
corresponding to the item type should be used. Other attributes further define
the item. A few examples:

```xml
<item name="bag of pearls"/>
<weapon name="enchanted sword" bonus="1"/>
<tool name="golden compass" ability="scouting" bonus="2"/>
<armour name="ring mail" bonus="2"/>
```

You can also match items in the character's possession by using the same
attributes in another tag, with the item type taking the place of the **name**
attribute. For example:

```xml
<if item="golden katana">
<choice item="lantern|candle" section="100">Continue into tunnel</choice>
<lose weapon="*" bonus="0">lose all your non-magical weapons</lose>
```

The `if` tag here tests whether the character has an item with the name 'golden
katana' (it could be a weapon, tool or even armour type). The `choice` tag, which
is used to give the player a set of choices to follow, will only enable if the
character possesses an item with the name of 'lantern' or 'candle'. The `lose`
action will remove all weapons with a bonus of 0 from the character's possession.
The wildcards '*' and '?' can be used in many attribute values, with the first
meaning 'match all', and the second meaning 'match one'.

## Effects

Items (and curses) may also have additional *effects*. These are either
attribute modifiers, or actions that occur when the item is used. These are
defined by additional tags nested within the item tags. For example:

```xml
<weapon name="sword of wood">
  <effect type="aura" ability="scouting" bonus="2"/>
</weapon>

<weapon name="Jade Defender" bonus="3">
  <effect type="wielded" ability="defence" bonus="3"/>
</weapon>

<item name="potion of restoration" verb="Drink">
  <effect type="use" uses="1">
    <rest/>
    <lose poison="*"/>
    <lose disease="*"/>
  </effect>
</item>

<item name="Black Diptych">
  <effect type="use" verb="Read" text="Court of Hidden Faces 410">
    <desc><i>Court of Hidden Faces</i> <b>410</b></desc>
    <goto book="5" section="410" hidden="t"/>
  </effect>
</item>
```

The first item uses the 'aura' effect type, which means that it will give a bonus
of 2 to Scouting while carried. The second item uses the 'wielded' effect type,
which means it only applies while the item (a weapon) is wielded; the sword is
listed as **Jade Defender (COMBAT +3, Defence +3)**. The third item is one that
can be used once to restore all Stamina (the `<rest/>` action, lacking all
attributes, does this), and cures any poisons or diseases. The last item is one
that can be used repeatedly to jump to section 410 of book 5. The **desc** tag
here supplies the description of the effect, so that the item will be displayed
as **Black Diptych (*Court of Hidden Faces* 410)**.

## Curses

Curses are similar to items that have ability effects. Poisons, diseases and
curses are the three types here, behaving the same way. To define a curse that
will be added to the character, use one of these types as the tag name. For
example:

```xml
<curse name="Curse of Donkey's Ears">
  <effect ability="charisma" bonus="-2"/>
</curse>
<disease name="Ghoulbite">
  <effect ability="sanctity" bonus="-1"/>
  <effect ability="combat" bonus="-1"/>
  <effect ability="charisma" bonus="-1"/>
</disease>
```

Like items, curses can be referred to in other tags by using the type of the
curse in place of the **name** attribute.

## Books

I should explain how the overall file-system is organised. In the root directory
of the program there is a file called 'books.ini', which contains details of all
the known books. The first few lines are as follows:

```ini
Books=1,2,3,4,5,6,7,8,9,10,11,12
1.Path=book1.zip
1.Title=The War-Torn Kingdom
2.Path=book2.zip
2.Title=Cities of Gold and Glory
```

Each known book has a *key* that is used to refer to that book. For the original
books I've used the book number, though any name (comprised of letters, digits
and underscores) would be OK. The books that the program is aware of are all
listed by their keys in the 'Books' line. The book keys are used in the XML
whenever a **book** attribute is used; for example, the action
`<goto book="1" section="100"/>` is shown as "*The War-Torn Kingdom* **100**".

Then each book has two entries, combining the book key with '.Path' and '.Title'.
The second obviously gives the book title; the first is the location of the files
for that book. This can either be a zip-file, or a directory locating the files
(more useful when developing the book).

For each book, there is a main 'book.ini' file which gives further details about
the book. The program will only decide that a book is available if this file can
be found.

```ini
Map=Violet Ocean.JPG
Map.Title=The Ports & Anchorages of the Violet Ocean
Death=123
Codewords=Cacogast,Calcium,Callid,Cancel,Catalyst,Cenotaph,Certain,Cerumen,Chance,\
          Cheese,Cheops,Chill,Church,Cithara,Citrus,Civil,Clanger,Clutch,Colour,Coracle,\
          Cosy,Covet,Crag,Crocus,Cruel,Cull,Curdle,Cushat,Cutlass,Cyclops,Cynosure
```

The first two lines here give the filename of the regional map, and the title to
use for that map. 'Death' is the section used when the character dies in that
book. The list of official codewords is the last thing here; this is the list
shown in the 'Codewords' window. Note that the backslash '\' can be used for a
run-on line.

'Adventurers.xml' gives the details of the starting characters. Rather than
describing this, it would probably be easier to look through one of the existing
ones, and changing the relevant parts. Book 5 has one in which each profession
starts with a different weapon. Finally, there's a 'New.xml' file which is used
when starting a game in that book, and a file for each of the starting characters
giving their histories. Again, these should be self-explanatory.
