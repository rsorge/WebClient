import { REGEX_EMAIL, EMAIL_FORMATING } from '../../constants';

const { OPEN_TAG_AUTOCOMPLETE_RAW, CLOSE_TAG_AUTOCOMPLETE_RAW } = EMAIL_FORMATING;

/* @ngInject */
function autocompleteEmailsItem(CONSTANTS, sanitize, sendPreferences, autoPinPrimaryKeys) {
    const KEY_ENTER = 13;

    /**
     * Change button [data-address] to delete the item
     * because we need it to match the address  inside the list
     * @param  {Node} node Component
     * @return {Function}     (address:String)
     */
    const buttonState = (node) => {
        const btn = node.querySelector('button');
        return (address) => btn.setAttribute('data-address', address);
    };

    /**
     * Extact and clean the new email
     * Format:
     *     - XXXX <xxx@xxxx.xxx>
     *     - xxx@xxxx.xxx
     * @param  {Node} target
     * @return {Object}        { name: String, adr:String }
     */
    const extractAddress = (target) => {
        const [name = '', adr = ''] = target.textContent.replace(CLOSE_TAG_AUTOCOMPLETE_RAW, '').split(OPEN_TAG_AUTOCOMPLETE_RAW);
        return { name: name.trim(), adr: adr.trim() };
    };

    return {
        replace: true,
        templateUrl: require('../../../templates/ui/autoCompleteEmailsItem.tpl.html'),
        link(scope, el) {
            const $span = el.find('span');
            const updateBtn = buttonState(el[0]);

            const onClick = ({ target }) => target.setAttribute('contenteditable', true);

            const onBlur = ({ target }) => {
                target.setAttribute('contenteditable', false);

                scope.$applyAsync(() => {
                    const { name, adr } = extractAddress(target);
                    const { Name: oldName, Address: oldAdr } = scope.email;
                    if (adr) {
                        scope.email.Address = adr;
                        scope.email.Name = sanitize.input(name);
                    }

                    if (name && !adr) {
                        scope.email.Name = name;
                        scope.email.Address = name;
                    }

                    scope.email.invalid = !REGEX_EMAIL.test(adr || name);
                    updateBtn(scope.email.Address);

                    if (scope.email.invalid) {
                        return;
                    }

                    !scope.email.invalid &&
                        sendPreferences.get([adr || name]).then(({ [adr || name]: sendPref }) => {
                            scope.$applyAsync(() => {
                                if (!sendPref.isVerified || !sendPref.primaryPinned) {
                                    // important: resign should go before repin: otherwise repin will do the resigning.
                                    const resign = sendPref.isVerified ? Promise.resolve(true) : autoPinPrimaryKeys.resign(adr || name);
                                    resign.then((resigned) => {
                                        if (!resigned) {
                                            scope.email.Address = oldAdr;
                                            scope.email.Name = oldName;
                                            target.innerText = scope.email.Address;
                                            updateBtn(scope.email.Address);
                                            return;
                                        }
                                        const repin = sendPref.primaryPinned ? Promise.resolve(true) : autoPinPrimaryKeys.confirm(adr || name);
                                        return repin.then((pinned) => {
                                            if (!pinned) {
                                                scope.email.Address = oldAdr;
                                                scope.email.Name = oldName;
                                                target.innerText = scope.email.Address;
                                                updateBtn(scope.email.Address);
                                            }
                                        });
                                    });

                                    return resign;
                                }
                                scope.email.encrypt = sendPref.encrypt;
                                scope.email.sign = sendPref.sign;
                                scope.email.isPgp = sendPref.scheme !== CONSTANTS.SEND_TYPES.SEND_PM && (scope.email.encrypt || scope.email.sign);
                                scope.email.isPinned = sendPref.pinned;
                                scope.email.loadCryptInfo = false;
                            });
                        });
                });
            };

            /*
                    Prevent event propagation for custom action by the main component.
                    And reset invalid state
                    ex: BACKSPACE
                 */
            const onInput = (e) => {
                if (e.keyCode === KEY_ENTER) {
                    return onBlur(e);
                }

                if (e.target.getAttribute('contenteditable') === 'true') {
                    e.stopPropagation();
                    scope.email.invalid && scope.$applyAsync(() => (scope.email.invalid = false));
                }
            };

            $span.on('keydown', onInput);
            $span.on('input', onInput);
            $span.on('click', onClick);
            $span.on('blur', onBlur);

            scope.$on('$destroy', () => {
                $span.off('keydown', onInput);
                $span.off('input', onInput);
                $span.off('click', onClick);
                $span.off('blur', onBlur);
            });
        }
    };
}
export default autocompleteEmailsItem;
