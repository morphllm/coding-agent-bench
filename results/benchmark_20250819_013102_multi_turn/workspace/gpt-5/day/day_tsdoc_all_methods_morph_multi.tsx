import { clsx } from "clsx";
import React, { Component, createRef } from "react";

import {
  getDay,
  getMonth,
  getDate,
  newDate,
  isSameDay,
  isDayDisabled,
  isDayExcluded,
  isDayInRange,
  isEqual,
  isBefore,
  isAfter,
  getDayOfWeekCode,
  getStartOfWeek,
  formatDate,
  type DateFilterOptions,
  type DateNumberType,
  type Locale,
  type HolidaysMap,
  KeyType,
} from "./date_utils";

/**
 * Props for the Day component. These configure behavior, accessibility, and rendering
 * of a single day cell within the date picker grid.
 *
 * Notes
 * - Selection behavior is controlled via combinations of selectsStart/selectsEnd/selectsRange/selectsMultiple,
 *   along with selected, selectedDates, startDate, and endDate.
 * - Date filtering and availability are governed by minDate/maxDate and include*/exclude* options.
 * - Event handlers (onClick, onMouseEnter, handleOnKeyDown) are invoked only when the day is not disabled.
 * - Rendering can be customized via dayClassName and renderDayContents.
 */
interface DayProps
  extends Pick<
    DateFilterOptions,
    | "minDate"
    | "maxDate"
    | "excludeDates"
    | "excludeDateIntervals"
    | "includeDateIntervals"
    | "includeDates"
    | "filterDate"
  > {
  ariaLabelPrefixWhenEnabled?: string;
  ariaLabelPrefixWhenDisabled?: string;
  disabledKeyboardNavigation?: boolean;
  day: Date;
  dayClassName?: (date: Date) => string;
  highlightDates?: Map<string, string[]>;
  holidays?: HolidaysMap;
  inline?: boolean;
  shouldFocusDayInline?: boolean;
  month: number;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  handleOnKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  usePointerEvent?: boolean;
  preSelection?: Date | null;
  selected?: Date | null;
  selectingDate?: Date;
  selectsEnd?: boolean;
  selectsStart?: boolean;
  selectsRange?: boolean;
  showWeekPicker?: boolean;
  showWeekNumber?: boolean;
  selectsDisabledDaysInRange?: boolean;
  selectsMultiple?: boolean;
  selectedDates?: Date[];
  startDate?: Date | null;
  endDate?: Date | null;
  renderDayContents?: (day: number, date: Date) => React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  calendarStartDay?: DateNumberType;
  locale?: Locale;
  monthShowsDuplicateDaysEnd?: boolean;
  monthShowsDuplicateDaysStart?: boolean;
}

/**
 * `Day` is a React component that represents a single day in a date picker.
 * It handles the rendering and interaction of a day.
 *
 * @prop ariaLabelPrefixWhenEnabled - Aria label prefix when the day is enabled.
 * @prop ariaLabelPrefixWhenDisabled - Aria label prefix when the day is disabled.
 * @prop disabledKeyboardNavigation - Whether keyboard navigation is disabled.
 * @prop day - The day to be displayed.
 * @prop dayClassName - Function to customize the CSS class of the day.
 * @prop endDate - The end date in a range.
 * @prop highlightDates - Map of dates to be highlighted.
 * @prop holidays - Map of holiday dates.
 * @prop inline - Whether the date picker is inline.
 * @prop shouldFocusDayInline - Whether the day should be focused when date picker is inline.
 * @prop month - The month the day belongs to.
 * @prop onClick - Click event handler.
 * @prop onMouseEnter - Mouse enter event handler.
 * @prop handleOnKeyDown - Key down event handler.
 * @prop usePointerEvent - Whether to use pointer events.
 * @prop preSelection - The date that is currently selected.
 * @prop selected - The selected date.
 * @prop selectingDate - The date currently being selected.
 * @prop selectsEnd - Whether the day can be the end date in a range.
 * @prop selectsStart - Whether the day can be the start date in a range.
 * @prop selectsRange - Whether the day can be in a range.
 * @prop showWeekPicker - Whether to show week picker.
 * @prop showWeekNumber - Whether to show week numbers.
 * @prop selectsDisabledDaysInRange - Whether to select disabled days in a range.
 * @prop selectsMultiple - Whether to allow multiple date selection.
 * @prop selectedDates - Array of selected dates.
 * @prop startDate - The start date in a range.
 * @prop renderDayContents - Function to customize the rendering of the day's contents.
 * @prop containerRef - Ref for the container.
 * @prop excludeDates - Array of dates to be excluded.
 * @prop calendarStartDay - The start day of the week.
 * @prop locale - The locale object.
 * @prop monthShowsDuplicateDaysEnd - Whether to show duplicate days at the end of the month.
 * @prop monthShowsDuplicateDaysStart - Whether to show duplicate days at the start of the month.
 * @prop includeDates - Array of dates to be included.
 * @prop includeDateIntervals - Array of date intervals to be included.
 * @prop minDate - The minimum date that can be selected.
 * @prop maxDate - The maximum date that can be selected.
 *
 * @example
 * ```tsx
 * import React from 'react';
 * import Day from './day';
 *
 * function MyComponent() {
 *   const handleDayClick = (event) => {
 *     console.log('Day clicked', event);
 *   };
 *
 *   const handleDayMouseEnter = (event) => {
 *     console.log('Mouse entered day', event);
 *   };
 *
 *   const renderDayContents = (date) => {
 *     return <div>{date.getDate()}</div>;
 *   };
 *
 *   return (
 *     <Day
 *       day={new Date()}
 *       onClick={handleDayClick}
 *       onMouseEnter={handleDayMouseEnter}
 *       renderDayContents={renderDayContents}
 *     />
 *   );
 * }
 *
 * export default MyComponent;
 * ```
 */
export default class Day extends Component<DayProps> {
  /**
   * Lifecycle hook: focuses the day element on initial mount when appropriate.
   * @returns void
   */
  componentDidMount() {
    this.handleFocusDay();
  }

  /**
   * Lifecycle hook: re-applies focus to the day element after updates when appropriate.
   * @returns void
   */
  componentDidUpdate() {
    this.handleFocusDay();
  }

  dayEl = createRef<HTMLDivElement>();

  /**
   * Handles click events on the day cell. Invokes the consumer's onClick when the day is not disabled.
   * @param event - The mouse event originating from the day cell.
   * @returns void
   */
  handleClick: DayProps["onClick"] = (event) => {
    if (!this.isDisabled() && this.props.onClick) {
      this.props.onClick(event);
    }
  };

  /**
   * Handles mouse enter (or pointer enter) events on the day cell. Invokes the consumer's onMouseEnter when not disabled.
   * @param event - The mouse event originating from the day cell.
   * @returns void
   */
  handleMouseEnter: DayProps["onMouseEnter"] = (event) => {
    if (!this.isDisabled() && this.props.onMouseEnter) {
      this.props.onMouseEnter(event);
    }
  };

  /**
   * Handles key down events for keyboard interaction. Converts Space to Enter for selection semantics
   * and forwards the event to the consumer handler.
   * @param event - The keyboard event.
   * @returns void
   */
  handleOnKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    const eventKey = event.key;
    if (eventKey === KeyType.Space) {
      event.preventDefault();
      event.key = KeyType.Enter;
    }

    this.props.handleOnKeyDown?.(event);
  };

  /**
   * Checks if the provided date is the same calendar day as this Day instance's date.
   * @param other - The date to compare with.
   * @returns True if both dates represent the same day; otherwise false.
   */
  isSameDay = (other: Date | null | undefined) =>
    isSameDay(this.props.day, other);

  /**
   * Determines whether this day should display the keyboard-focused style.
   * Considers disabledKeyboardNavigation, current selection(s), and preSelection.
   * @returns True if the day is the current keyboard selection target; otherwise false.
   */
  isKeyboardSelected = () => {
    if (this.props.disabledKeyboardNavigation) {
      return false;
    }

    const isSelectedDate = this.props.selectsMultiple
      ? this.props.selectedDates?.some((date) => this.isSameDayOrWeek(date))
      : this.isSameDayOrWeek(this.props.selected);

    const isDisabled =
      this.props.preSelection && this.isDisabled(this.props.preSelection);

    return (
      !isSelectedDate &&
      this.isSameDayOrWeek(this.props.preSelection) &&
      !isDisabled
    );
  };

  /**
   * Indicates whether a given day (defaulting to this.props.day) is disabled based on filter options.
   * @param day - The date to test; defaults to the current day for this instance.
   * @returns True if the day is disabled; otherwise false.
   */
  isDisabled = (day = this.props.day) =>
    // Almost all props previously were passed as this.props w/o proper typing with prop-types
    // after the migration to TS i made it explicit
    isDayDisabled(day, {
      minDate: this.props.minDate,
      maxDate: this.props.maxDate,
      excludeDates: this.props.excludeDates,
      excludeDateIntervals: this.props.excludeDateIntervals,
      includeDateIntervals: this.props.includeDateIntervals,
      includeDates: this.props.includeDates,
      filterDate: this.props.filterDate,
    });

  /**
   * Indicates whether the current day is explicitly excluded.
   * @returns True if excluded by excludeDates or excludeDateIntervals; otherwise false.
   */
  isExcluded = () =>
    // Almost all props previously were passed as this.props w/o proper typing with prop-types
    // after the migration to TS i made it explicit
    isDayExcluded(this.props.day, {
      excludeDates: this.props.excludeDates,
      excludeDateIntervals: this.props.excludeDateIntervals,
    });

  /**
   * Checks if the day is the first day of the week, respecting locale and calendarStartDay.
   * @returns True if this day is the start of its week; otherwise false.
   */
  isStartOfWeek = () =>
    isSameDay(
      this.props.day,
      getStartOfWeek(
        this.props.day,
        this.props.locale,
        this.props.calendarStartDay,
      ),
    );

  /**
   * Determines whether the given date is in the same week (matches the start of week) as this day.
   * Only relevant when showWeekPicker is enabled.
   * @param other - The date to compare with.
   * @returns True if other is the same week; otherwise false.
   */
  isSameWeek = (other?: Date | null) =>
    this.props.showWeekPicker &&
    isSameDay(
      other,
      getStartOfWeek(
        this.props.day,
        this.props.locale,
        this.props.calendarStartDay,
      ),
    );

  /**
   * Convenience predicate: true if the given date is the same calendar day or the same week (when applicable).
   * @param other - The date to compare with.
   * @returns True if same day or same week; otherwise false.
   */
  isSameDayOrWeek = (other?: Date | null) =>
    this.isSameDay(other) || this.isSameWeek(other);

  /**
   * Resolves highlight CSS classes for the current day from the highlightDates map.
   * @returns An array of class names when highlighted, undefined when not found, or false when highlighting is not configured.
   */
  getHighLightedClass = () => {
    const { day, highlightDates } = this.props;

    if (!highlightDates) {
      return false;
    }

    // Looking for className in the Map of {'day string, 'className'}
    const dayStr = formatDate(day, "MM.dd.yyyy");
    return highlightDates.get(dayStr);
  };

  /**
   * Returns an array containing the holiday class name for the current day, if any.
   * @returns A single-element array with the holiday class name or [undefined] for type consistency.
   */
  // Function to return the array containing className associated to the date
  getHolidaysClass = () => {
    const { day, holidays } = this.props;
    if (!holidays) {
      // For type consistency no other reasons
      return [undefined];
    }
    const dayStr = formatDate(day, "MM.dd.yyyy");
    // Looking for className in the Map of {day string: {className, holidayName}}
    if (holidays.has(dayStr)) {
      return [holidays.get(dayStr)?.className];
    }

    // For type consistency no other reasons
    return [undefined];
  };

  /**
   * Checks whether this day lies within the inclusive range [startDate, endDate].
   * @returns True if in range and both endpoints exist; otherwise false.
   */
  isInRange = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isDayInRange(day, startDate, endDate);
  };

  /**
   * Determines whether this day is within the currently selecting range while the user is picking dates.
   * Considers selectsStart/selectsEnd/selectsRange, selectingDate/preSelection, and optionally disabled days.
   * @returns True if the day falls within the active selecting range; otherwise false.
   */
  isInSelectingRange = () => {
    const {
      day,
      selectsStart,
      selectsEnd,
      selectsRange,
      selectsDisabledDaysInRange,
      startDate,
      endDate,
    } = this.props;

    const selectingDate = this.props.selectingDate ?? this.props.preSelection;

    if (
      !(selectsStart || selectsEnd || selectsRange) ||
      !selectingDate ||
      (!selectsDisabledDaysInRange && this.isDisabled())
    ) {
      return false;
    }

    if (
      selectsStart &&
      endDate &&
      (isBefore(selectingDate, endDate) || isEqual(selectingDate, endDate))
    ) {
      return isDayInRange(day, selectingDate, endDate);
    }

    if (
      selectsEnd &&
      startDate &&
      (isAfter(selectingDate, startDate) || isEqual(selectingDate, startDate))
    ) {
      return isDayInRange(day, startDate, selectingDate);
    }

    if (
      selectsRange &&
      startDate &&
      !endDate &&
      (isAfter(selectingDate, startDate) || isEqual(selectingDate, startDate))
    ) {
      return isDayInRange(day, startDate, selectingDate);
    }

    return false;
  };

  /**
   * Indicates whether this day is the start of the selecting range.
   * @returns True if selecting range start; otherwise false.
   */
  isSelectingRangeStart = () => {
    if (!this.isInSelectingRange()) {
      return false;
    }

    const { day, startDate, selectsStart } = this.props;
    const selectingDate = this.props.selectingDate ?? this.props.preSelection;

    if (selectsStart) {
      return isSameDay(day, selectingDate);
    } else {
      return isSameDay(day, startDate);
    }
  };

  /**
   * Indicates whether this day is the end of the selecting range.
   * @returns True if selecting range end; otherwise false.
   */
  isSelectingRangeEnd = () => {
    if (!this.isInSelectingRange()) {
      return false;
    }

    const { day, endDate, selectsEnd, selectsRange } = this.props;
    const selectingDate = this.props.selectingDate ?? this.props.preSelection;

    if (selectsEnd || selectsRange) {
      return isSameDay(day, selectingDate);
    } else {
      return isSameDay(day, endDate);
    }
  };

  /**
   * Indicates whether this day is the start of a confirmed range (between startDate and endDate).
   * @returns True if this day is startDate; otherwise false.
   */
  isRangeStart = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isSameDay(startDate, day);
  };

  /**
   * Indicates whether this day is the end of a confirmed range (between startDate and endDate).
   * @returns True if this day is endDate; otherwise false.
   */
  isRangeEnd = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isSameDay(endDate, day);
  };

  /**
   * Checks whether this day falls on a weekend (Saturday or Sunday).
   * @returns True if weekend; otherwise false.
   */
  isWeekend = () => {
    const weekday = getDay(this.props.day);
    return weekday === 0 || weekday === 6;
  };

  /**
   * Indicates whether this day is displayed from the following month (after the current grid month).
   * @returns True if the day belongs to the month after this.props.month; otherwise false.
   */
  isAfterMonth = () => {
    return (
      this.props.month !== undefined &&
      (this.props.month + 1) % 12 === getMonth(this.props.day)
    );
  };

  /**
   * Indicates whether this day is displayed from the previous month (before the current grid month).
   * @returns True if the day belongs to the month before this.props.month; otherwise false.
   */
  isBeforeMonth = () => {
    return (
      this.props.month !== undefined &&
      (getMonth(this.props.day) + 1) % 12 === this.props.month
    );
  };

  /**
   * Indicates whether this day is today according to the system clock.
   * @returns True if equal to today; otherwise false.
   */
  isCurrentDay = () => this.isSameDay(newDate());

  /**
   * Indicates whether this day is currently selected. Supports single and multiple selection,
   * and week-based selection when showWeekPicker is enabled.
   * @returns True if selected; otherwise false.
   */
  isSelected = () => {
    if (this.props.selectsMultiple) {
      return this.props.selectedDates?.some((date) =>
        this.isSameDayOrWeek(date),
      );
    }
    return this.isSameDayOrWeek(this.props.selected);
  };

  /**
   * Computes the CSS class string for this day, combining base classes with state-dependent classes
   * and any user-provided dayClassName/highlight/holiday classes.
   * @param date - The date for which to compute class names (typically this.props.day).
   * @returns A space-delimited string of class names.
   */
  getClassNames = (date: Date) => {
    const dayClassName = this.props.dayClassName
      ? this.props.dayClassName(date)
      : undefined;
    return clsx(
      "react-datepicker__day",
      dayClassName,
      "react-datepicker__day--" + getDayOfWeekCode(this.props.day),
      {
        "react-datepicker__day--disabled": this.isDisabled(),
        "react-datepicker__day--excluded": this.isExcluded(),
        "react-datepicker__day--selected": this.isSelected(),
        "react-datepicker__day--keyboard-selected": this.isKeyboardSelected(),
        "react-datepicker__day--range-start": this.isRangeStart(),
        "react-datepicker__day--range-end": this.isRangeEnd(),
        "react-datepicker__day--in-range": this.isInRange(),
        "react-datepicker__day--in-selecting-range": this.isInSelectingRange(),
        "react-datepicker__day--selecting-range-start":
          this.isSelectingRangeStart(),
        "react-datepicker__day--selecting-range-end":
          this.isSelectingRangeEnd(),
        "react-datepicker__day--today": this.isCurrentDay(),
        "react-datepicker__day--weekend": this.isWeekend(),
        "react-datepicker__day--outside-month":
          this.isAfterMonth() || this.isBeforeMonth(),
      },
      this.getHighLightedClass(),
      this.getHolidaysClass(),
    );
  };

  /**
   * Builds an accessible aria-label for the day reflecting availability and localized date.
   * @returns The aria-label string.
   */
  getAriaLabel = () => {
    const {
      day,
      ariaLabelPrefixWhenEnabled = "Choose",
      ariaLabelPrefixWhenDisabled = "Not available",
    } = this.props;

    const prefix =
      this.isDisabled() || this.isExcluded()
        ? ariaLabelPrefixWhenDisabled
        : ariaLabelPrefixWhenEnabled;

    return `${prefix} ${formatDate(day, "PPPP", this.props.locale)}`;
  };

  /**
   * Produces the text shown in the title/tooltip for the day, typically concatenating holiday names
   * and exclusion messages when applicable.
   * @returns A comma-separated string of titles; empty string when none.
   */
  // A function to return the holiday's name as title's content
  getTitle = () => {
    const { day, holidays = new Map(), excludeDates } = this.props;
    const compareDt = formatDate(day, "MM.dd.yyyy");
    const titles: Array<string | undefined> = [];
    if (holidays.has(compareDt)) {
      titles.push(...holidays.get(compareDt).holidayNames);
    }
    if (this.isExcluded()) {
      titles.push(
        excludeDates
          ?.filter((excludeDate) => {
            if (excludeDate instanceof Date) {
              return isSameDay(excludeDate, day);
            }
            return isSameDay(excludeDate?.date, day);
          })
          .map((excludeDate) => {
            if (excludeDate instanceof Date) {
              return undefined;
            }
            return excludeDate?.message;
          }),
      );
    }
    // I'm not sure that this is a right output, but all tests are green
    return titles.join(", ");
  };

  /**
   * Determines the tabIndex for the day element to support keyboard navigation.
   * @returns 0 when the day should be tabbable, otherwise -1.
   */
  getTabIndex = () => {
    const selectedDay = this.props.selected;
    const preSelectionDay = this.props.preSelection;
    const tabIndex =
      !(
        this.props.showWeekPicker &&
        (this.props.showWeekNumber || !this.isStartOfWeek())
      ) &&
      (this.isKeyboardSelected() ||
        (this.isSameDay(selectedDay) &&
          isSameDay(preSelectionDay, selectedDay)))
        ? 0
        : -1;

    return tabIndex;
  };

  /**
   * Applies focus to the day element when the conditions determined by shouldFocusDay are met.
   * @returns void
   */
  // various cases when we need to apply focus to the preselected day
  // focus the day on mount/update so that keyboard navigation works while cycling through months with up or down keys (not for prev and next month buttons)
  // prevent focus for these activeElement cases so we don't pull focus from the input as the calendar opens
  handleFocusDay = () => {
    // only do this while the input isn't focused
    // otherwise, typing/backspacing the date manually may steal focus away from the input
    this.shouldFocusDay() && this.dayEl.current?.focus({ preventScroll: true });
  };

  private shouldFocusDay() {
    let shouldFocusDay = false;
    if (this.getTabIndex() === 0 && this.isSameDay(this.props.preSelection)) {
      // there is currently no activeElement and not inline
      if (!document.activeElement || document.activeElement === document.body) {
        shouldFocusDay = true;
      }
      // inline version:
      // do not focus on initial render to prevent autoFocus issue
      // focus after month has changed via keyboard
      if (this.props.inline && !this.props.shouldFocusDayInline) {
        shouldFocusDay = false;
      }
      if (this.isDayActiveElement()) {
        shouldFocusDay = true;
      }
      if (this.isDuplicateDay()) {
        shouldFocusDay = false;
      }
    }
    return shouldFocusDay;
  }

  // the activeElement is in the container, and it is another instance of Day
  private isDayActiveElement() {
    return (
      this.props.containerRef?.current?.contains(document.activeElement) &&
      document.activeElement?.classList.contains("react-datepicker__day")
    );
  }

  private isDuplicateDay() {
    return (
      //day is one of the non rendered duplicate days
      (this.props.monthShowsDuplicateDaysEnd && this.isAfterMonth()) ||
      (this.props.monthShowsDuplicateDaysStart && this.isBeforeMonth())
    );
  }

  /**
   * Renders the visual content inside the day cell. If the day is a duplicate (outside current month) and configured
   * to be hidden, returns null. Otherwise, uses renderDayContents when provided, falling back to the numeric day.
   * @returns The content to render for the day cell.
   */
  renderDayContents = () => {
    if (this.props.monthShowsDuplicateDaysEnd && this.isAfterMonth())
      return null;
    if (this.props.monthShowsDuplicateDaysStart && this.isBeforeMonth())
      return null;
    return this.props.renderDayContents
      ? this.props.renderDayContents(getDate(this.props.day), this.props.day)
      : getDate(this.props.day);
  };

  /**
   * Renders the day cell element with appropriate attributes, classes, and event handlers.
   * @returns The JSX element representing the day.
   */
  render = () => (
    // TODO: Use <option> instead of the "option" role to ensure accessibility across all devices.
    <div
      ref={this.dayEl}
      className={this.getClassNames(this.props.day)}
      onKeyDown={this.handleOnKeyDown}
      onClick={this.handleClick}
      onMouseEnter={
        !this.props.usePointerEvent ? this.handleMouseEnter : undefined
      }
      onPointerEnter={
        this.props.usePointerEvent ? this.handleMouseEnter : undefined
      }
      tabIndex={this.getTabIndex()}
      aria-label={this.getAriaLabel()}
      role="option"
      title={this.getTitle()}
      aria-disabled={this.isDisabled()}
      aria-current={this.isCurrentDay() ? "date" : undefined}
      aria-selected={this.isSelected() || this.isInRange()}
    >
      {this.renderDayContents()}
      {this.getTitle() !== "" && (
        <span className="overlay">{this.getTitle()}</span>
      )}
    </div>
  );
}