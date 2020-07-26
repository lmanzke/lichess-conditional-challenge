# Introduction

This is a chrome extension for lichess.org. It was originally created out of a need by GM Niclas Huschenbeth and is
inspired by the random challenge chooser by GitProphet/SimonLammer ([Repo](https://github.com/SimonLammer/lichess-accept-random-challenge)).
However, that one did not the infrastructure I liked so I decided to rewrite a new extension.

The extension allows for some more options for incoming challenges to be accepted, specifically filtering by:

- Rating
- Number of past encounters
- Membership in a certain team (which was the original usecase [requested](https://github.com/ornicar/lila/issues/6737) by GM Huschenbeth)

It is powered by [Vue.js](https://github.com/vuejs/vue), although one could argue that it might be overkill for this particular usage. As I still think it is an awesome
framework (and the overhead - which is small anyway - is irrelevant for a chrome extension), I used it anyway.

Furthermore, at the moment, the extension uses jquery as a query builder component is involved. I am probably going to replace this
at some point to get rid of some dependencies (and one makes use of eval so I had to lower the extension's content security policy), but for now, it is used as the configuration 
module for the extension.

# Usage

After installation, the usage is straightforward. Similar to the random chooser, it displays an extra button in the challenge
menu which will select a random challenge that **meets the selected criteria**.

These criteria can be specified in the extension options by creating an arbitrarily complex tree of conditions linked via AND / OR.

For example, one could say: Only accept challenges from players who 
- are in team ExampleTeam AND were not encountered more than 3 times 

OR

- have a rating between 1200 and 1500

The operations use logical operators and can be nested, allowing for complex decision trees.

# Way of working & Caveats

The extension works by random selecting any challenge and checking if it matches the criteria. 

If yes, the challenge is accepted.

If it does not match, it is declined and the process is repeated with another random challenge.

Some of the conditions (namely team membership and number of encounters) required an API call. That is necessary as the needed information
cannot be extracted directly from the challenge element. That means that a significant number of api requests might be fired 
to the lichess server if there are many challenges that do not fulfill the requirements. I have not yet encountered an API limit, but
it might well be the case that a request fails. I have to think more about error recovery strategies or different matching - 
for example prefetching all player names for the valid teams in case that is a condition (and the API limit becomes an issue).

Please also note that because of the way the extension works, not **all** challenges that do not match are declined but only those that 
are ancountered "on the way" to accepting a valid challenge.

# Requests

If you have any ideas or requests for other conditions, you can open an issue in this repository.

# Donations

If you like this extension, I'd be happy about a [small donation](paypal.me/lumanzke/5)! :)

