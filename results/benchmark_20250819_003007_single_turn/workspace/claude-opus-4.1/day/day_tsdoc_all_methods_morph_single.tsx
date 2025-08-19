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
 * Props for the Day component.
 * Defines configuration options for rendering and interacting with a single day in the date picker.
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
  /** Aria label prefix to use when the day is enabled */
  ariaLabelPrefixWhenEnabled?: string;
  /** Aria label prefix to use when the day is disabled */
  ariaLabelPrefixWhenDisabled?: string;
  /** Whether keyboard navigation is disabled for this day */
  disabledKeyboardNavigation?: boolean;
  /** The date object representing this day */
  day: Date;
  /** Function to generate custom CSS class names for the day */
  dayClassName?: (date: Date) => string;
  /** Map of dates to highlight with their associated CSS classes */
  highlightDates?: Map<string, string[]>;
  /** Map of holiday dates with their metadata */
  holidays?: HolidaysMap;
  /** Whether the date picker is displayed inline */
  inline?: boolean;
  /** Whether to focus the day when displayed inline */
  shouldFocusDayInline?: boolean;
  /** The month number this day belongs to */
  month: number;
  /** Handler for click events on the day */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  /** Handler for mouse enter events on the day */
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  /** Handler for keyboard events on the day */
  handleOnKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  /** Whether to use pointer events instead of mouse events */
  usePointerEvent?: boolean;
  /** The currently pre-selected date (for keyboard navigation) */
  preSelection?: Date | null;
  /** The currently selected date */
  selected?: Date | null;
  /** The date being selected during range selection */
  selectingDate?: Date;
  /** Whether this day can be selected as the end of a date range */
  selectsEnd?: boolean;
  /** Whether this day can be selected as the start of a date range */
  selectsStart?: boolean;
  /** Whether range selection mode is enabled */
  selectsRange?: boolean;
  /** Whether week picker mode is enabled */
  showWeekPicker?: boolean;
  /** Whether to show week numbers */
  showWeekNumber?: boolean;
  /** Whether to allow selection of disabled days within a range */
  selectsDisabledDaysInRange?: boolean;
  /** Whether multiple date selection is enabled */
  selectsMultiple?: boolean;
  /** Array of selected dates when multiple selection is enabled */
  selectedDates?: Date[];
  /** The start date of a selected range */
  startDate?: Date | null;
  /** The end date of a selected range */
  endDate?: Date | null;
  /** Custom render function for day contents */
  renderDayContents?: (day: number, date: Date) => React.ReactNode;
  /** Reference to the container element */
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /** The first day of the week (0-6, where 0 is Sunday) */
  calendarStartDay?: DateNumberType;
  /** Locale configuration for date formatting */
  locale?: Locale;
  /** Whether to show duplicate days at the end of the month */
  monthShowsDuplicateDaysEnd?: boolean;
  /** Whether to show duplicate days at the start of the month */
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
  componentDidMount() {
    this.handleFocusDay();
  }

  componentDidUpdate() {
    this.handleFocusDay();
  }

  dayEl = createRef<HTMLDivElement>();

  /**
   * Handles click events on the day element.
   * Only triggers the onClick prop if the day is not disabled.
   * @param event - The mouse event from the click
   */
  handleClick: DayProps["onClick"] = (event) => {
    if (!this.isDisabled() && this.props.onClick) {
      this.props.onClick(event);
    }
  };

  /**
   * Handles mouse enter events on the day element.
   * Only triggers the onMouseEnter prop if the day is not disabled.
   * @param event - The mouse event from the hover
   */
  handleMouseEnter: DayProps["onMouseEnter"] = (event) => {
    if (!this.isDisabled() && this.props.onMouseEnter) {
      this.props.onMouseEnter(event);
    }
  };

  /**
   * Handles keyboard events on the day element.
   * Converts Space key to Enter key for consistent behavior.
   * @param event - The keyboard event
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
   * Checks if this day is the same as another date.
   * @param other - The date to compare against
   * @returns True if the dates are the same day, false otherwise
   */
  isSameDay = (other: Date | null | undefined) =>
    isSameDay(this.props.day, other);

  /**
   * Determines if this day should be highlighted for keyboard navigation.
   * @returns True if the day is selected via keyboard navigation, false otherwise
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
   * Determines if a day is disabled based on the configured constraints.
   * @param day - The day to check (defaults to the component's day prop)
   * @returns True if the day is disabled, false otherwise
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
   * Checks if this day is excluded from selection.
   * @returns True if the day is excluded, false otherwise
   */
  isExcluded = () =>
    // Almost all props previously were passed as this.props w/o proper typing with prop-types
    // after the migration to TS i made it explicit
    isDayExcluded(this.props.day, {
      excludeDates: this.props.excludeDates,
      excludeDateIntervals: this.props.excludeDateIntervals,
    });

  /**
   * Checks if this day is the start of a week.
   * @returns True if the day is the first day of the week, false otherwise
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
   * Checks if another date is in the same week as this day.
   * Only applies when week picker mode is enabled.
   * @param other - The date to compare
   * @returns True if the dates are in the same week, false otherwise
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
   * Checks if another date is either the same day or in the same week as this day.
   * @param other - The date to compare
   * @returns True if the dates match by day or week, false otherwise
   */
  isSameDayOrWeek = (other?: Date | null) =>
    this.isSameDay(other) || this.isSameWeek(other);

  /**
   * Gets the CSS class names for highlighted dates.
   * @returns Array of CSS class names if the day is highlighted, false otherwise
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
   * Gets the CSS class names for holidays.
   * @returns Array containing the holiday CSS class name, or [undefined] if not a holiday
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
   * Checks if this day is within a selected date range.
   * @returns True if the day is between the start and end dates, false otherwise
   */
  isInRange = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isDayInRange(day, startDate, endDate);
  };

  /**
   * Checks if this day is within the range currently being selected.
   * @returns True if the day is in the selecting range, false otherwise
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
   * Checks if this day is the start of a range being selected.
   * @returns True if the day is the start of the selecting range, false otherwise
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
   * Checks if this day is the end of a range being selected.
   * @returns True if the day is the end of the selecting range, false otherwise
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
   * Checks if this day is the start of a selected range.
   * @returns True if the day is the range start, false otherwise
   */
  isRangeStart = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isSameDay(startDate, day);
  };

  /**
   * Checks if this day is the end of a selected range.
   * @returns True if the day is the range end, false otherwise
   */
  isRangeEnd = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isSameDay(endDate, day);
  };

  /**
   * Checks if this day falls on a weekend (Saturday or Sunday).
   * @returns True if the day is a weekend, false otherwise
   */
  isWeekend = () => {
    const weekday = getDay(this.props.day);
    return weekday === 0 || weekday === 6;
  };

  /**
   * Checks if this day belongs to the month after the current month view.
   * @returns True if the day is in the next month, false otherwise
   */
  isAfterMonth = () => {
    return (
      this.props.month !== undefined &&
      (this.props.month + 1) % 12 === getMonth(this.props.day)
    );
  };

  /**
   * Checks if this day belongs to the month before the current month view.
   * @returns True if the day is in the previous month, false otherwise
   */
  isBeforeMonth = () => {
    return (
      this.props.month !== undefined &&
      (getMonth(this.props.day) + 1) % 12 === this.props.month
    );
  };

  /**
   * Checks if this day is today's date.
   * @returns True if the day is today, false otherwise
   */
  isCurrentDay = () => this.isSameDay(newDate());

  /**
   * Checks if this day is selected.
   * Handles both single and multiple selection modes.
   * @returns True if the day is selected, false otherwise
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
   * Generates the complete set of CSS class names for the day element.
   * @param date - The date to generate classes for
   * @returns A string of space-separated CSS class names
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
   * Generates the ARIA label for the day element.
   * @returns A descriptive string for screen readers
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
   * Generates the title attribute content for the day element.
   * Includes holiday names and exclusion messages.
   * @returns A string containing holiday names and/or exclusion messages
   */
  // A function to return the holiday's name as title's content
  getTitle = () => {
    const { day, holidays = new Map(), excludeDates } = this.props;
    const compareDt = formatDate(day, "MM.dd.yyyy");
    const titles = [];
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
   * Calculates the tab index for the day element.
   * Determines keyboard navigation accessibility.
   * @returns 0 if the day should be focusable, -1 otherwise
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
   * Handles focusing the day element when appropriate.
   * Called on mount and update to manage keyboard navigation focus.
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
      // day is one of the non rendered duplicate days
      (this.props.monthShowsDuplicateDaysEnd && this.isAfterMonth()) ||
      (this.props.monthShowsDuplicateDaysStart && this.isBeforeMonth())
    );
  }

  /**
   * Renders the content inside the day element.
   * @returns The day number or custom content, or null for duplicate days
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
   * Renders the complete day component.
   * @returns A div element representing the day with all appropriate attributes and event handlers
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