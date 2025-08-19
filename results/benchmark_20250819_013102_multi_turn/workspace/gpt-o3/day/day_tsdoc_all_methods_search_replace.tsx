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
 * Props for the `Day` component.
 *
 * These values drive the visual state, accessibility labels, and behaviour of a
 * single calendar day. Unless stated otherwise the prop affects only the
 * instance it is passed to.
 *
 * Required props:
 * – `day`   – The exact calendar date represented by the cell.
 * – `month` – The month currently being rendered; this is used to decide
 *   whether the day is part of a leading or trailing range from an adjacent
 *   month.
 */
/**
 * Collection of props that configure the behaviour and appearance of a single
 * `<Day />` cell. Most fields are optional because the parent `Calendar`
 * component decides which capabilities to enable for a given day instance.
 *
 * Wherever possible the descriptions mirror the language used by
 * `react-datepicker` so that developers familiar with the JavaScript version
 * can transfer knowledge easily.
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
  /** Screen-reader prefix applied when the day is **not** disabled (defaults to `"Choose"`). */
  ariaLabelPrefixWhenEnabled?: string;
  /** Screen-reader prefix applied when the day **is** disabled (defaults to `"Not available"`). */
  ariaLabelPrefixWhenDisabled?: string;
  /** When true the Day will not capture focus while navigating with the keyboard. */
  disabledKeyboardNavigation?: boolean;
  /** The concrete calendar date represented by this cell. */
  day: Date;
  /** Optional function that returns an additional CSS class for the cell. */
  dayClassName?: (date: Date) => string;
  /** Map whose keys are `'MM.dd.yyyy'` strings and whose values are arrays of CSS classes to apply for highlighted days. */
  highlightDates?: Map<string, string[]>;
  /** Map keyed by `'MM.dd.yyyy'` that describes holidays and their presentation class. */
  holidays?: HolidaysMap;
  /** Render the day in “inline” mode (no pop-over, always visible). */
  inline?: boolean;
  /** In inline mode: whether the cell should receive focus automatically. */
  shouldFocusDayInline?: boolean;
  /** The month currently being rendered; used to hide duplicate leading/trailing days. */
  month: number;
  /** Mouse click handler fired when the user activates the cell. */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  /** Mouse-enter / pointer-enter handler for hover feedback. */
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  /** Low-level key-down handler; receives already-normalised events. */
  handleOnKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  /** When true the component listens to `pointerenter` instead of `mouseenter`. */
  usePointerEvent?: boolean;
  /** The date that currently has focus (keyboard selection). */
  preSelection?: Date | null;
  /** For single-selection mode: the selected date or `null`. */
  selected?: Date | null;
  /** The date that is currently being selected while dragging. */
  selectingDate?: Date;
  /** Enable the “range end” selection semantics. */
  selectsEnd?: boolean;
  /** Enable the “range start” selection semantics. */
  selectsStart?: boolean;
  /** Enable full range selection semantics (`start` + `end`). */
  selectsRange?: boolean;
  /** Render the component in week-picker mode. */
  showWeekPicker?: boolean;
  /** Show the ISO week number column. */
  showWeekNumber?: boolean;
  /** When true the range may include disabled days. */
  selectsDisabledDaysInRange?: boolean;
  /** Enable the multi-date selection mode. */
  selectsMultiple?: boolean;
  /** Currently selected dates in multi-select mode. */
  selectedDates?: Date[];
  /** The first date of a selected range. */
  startDate?: Date | null;
  /** The last date of a selected range. */
  endDate?: Date | null;
  /** Custom renderer for the cell contents. */
  renderDayContents?: (day: number, date: Date) => React.ReactNode;
  /** Ref pointing at the container element that owns the collection of Day cells. */
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /** Sets which weekday the calendar grid should start on (`0` = Sunday, `1` = Monday…). */
  calendarStartDay?: DateNumberType;
  /** Locale bundle used for date-formatting and week-start calculations. */
  locale?: Locale;
  /** When true, duplicate trailing days of the current month are rendered (internal). */
  monthShowsDuplicateDaysEnd?: boolean;
  /** When true, duplicate leading days of the current month are rendered (internal). */
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

  handleClick: DayProps["onClick"] = (event) => {
    if (!this.isDisabled() && this.props.onClick) {
      this.props.onClick(event);
    }
  };

  handleMouseEnter: DayProps["onMouseEnter"] = (event) => {
    if (!this.isDisabled() && this.props.onMouseEnter) {
      this.props.onMouseEnter(event);
    }
  };

  handleOnKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    const eventKey = event.key;
    if (eventKey === KeyType.Space) {
      event.preventDefault();
      event.key = KeyType.Enter;
    }

    this.props.handleOnKeyDown?.(event);
  };

  isSameDay = (other: Date | null | undefined) =>
    isSameDay(this.props.day, other);

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

  isExcluded = () =>
    // Almost all props previously were passed as this.props w/o proper typing with prop-types
    // after the migration to TS i made it explicit
    isDayExcluded(this.props.day, {
      excludeDates: this.props.excludeDates,
      excludeDateIntervals: this.props.excludeDateIntervals,
    });

  isStartOfWeek = () =>
    isSameDay(
      this.props.day,
      getStartOfWeek(
        this.props.day,
        this.props.locale,
        this.props.calendarStartDay,
      ),
    );

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

  isSameDayOrWeek = (other?: Date | null) =>
    this.isSameDay(other) || this.isSameWeek(other);

  getHighLightedClass = () => {
    const { day, highlightDates } = this.props;

    if (!highlightDates) {
      return false;
    }

    // Looking for className in the Map of {'day string, 'className'}
    const dayStr = formatDate(day, "MM.dd.yyyy");
    return highlightDates.get(dayStr);
  };

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

  isInRange = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isDayInRange(day, startDate, endDate);
  };

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

  isRangeStart = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isSameDay(startDate, day);
  };

  isRangeEnd = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isSameDay(endDate, day);
  };

  isWeekend = () => {
    const weekday = getDay(this.props.day);
    return weekday === 0 || weekday === 6;
  };

  isAfterMonth = () => {
    return (
      this.props.month !== undefined &&
      (this.props.month + 1) % 12 === getMonth(this.props.day)
    );
  };

  isBeforeMonth = () => {
    return (
      this.props.month !== undefined &&
      (getMonth(this.props.day) + 1) % 12 === this.props.month
    );
  };

  isCurrentDay = () => this.isSameDay(newDate());

  isSelected = () => {
    if (this.props.selectsMultiple) {
      return this.props.selectedDates?.some((date) =>
        this.isSameDayOrWeek(date),
      );
    }
    return this.isSameDayOrWeek(this.props.selected);
  };

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

  renderDayContents = () => {
    if (this.props.monthShowsDuplicateDaysEnd && this.isAfterMonth())
      return null;
    if (this.props.monthShowsDuplicateDaysStart && this.isBeforeMonth())
      return null;
    return this.props.renderDayContents
      ? this.props.renderDayContents(getDate(this.props.day), this.props.day)
      : getDate(this.props.day);
  };

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

/**
 * Props accepted by the `Day` component. These values drive the visual state,
 * accessibility labels and behaviour of a single calendar day.
 *
 * See the original `DayProps` declaration above for a full list of fields; this
 * ambient redeclaration is included only so that tooling can surface the
 * description via TSDoc.
 */
interface DayProps {}

/**
 * Ambient interface used exclusively for documentation purposes. Each member
 * mirrors one of the public methods of the `Day` class and is annotated with
 * rich TSDoc describing its intent, parameters and return value.
 *
 * Declaring this interface allows us to attach documentation without modifying
 * the runtime implementation — the declarations are erased during
 * compilation.
 */
interface Day {
  /**
   * React lifecycle: Invoked immediately after the component is mounted. It
   * forwards focus to the day element when appropriate so that keyboard
   * navigation works as expected.
   *
   * @returns void
   */
  componentDidMount(): void;

  /**
   * React lifecycle: Called immediately after an update occurs. We reuse the
   * same focusing logic as in `componentDidMount` so that the correct day
   * retains focus while users page through the calendar.
   *
   * @returns void
   */
  componentDidUpdate(): void;

  /**
   * Click handler for the day element.
   *
   * @param event - The mouse event created by the click.
   * @returns void
   */
  handleClick(event: React.MouseEvent<HTMLDivElement>): void;

  /**
   * Mouse-over / pointer-over handler for the day element.
   *
   * @param event - The mouse event generated when the pointer enters the day
   * element.
   * @returns void
   */
  handleMouseEnter(event: React.MouseEvent<HTMLDivElement>): void;

  /**
   * Keyboard handler that normalises space-bar presses to enter key presses so
   * that the component behaves like a native option element.
   *
   * @param event - The keyboard event emitted by the browser.
   * @returns void
   */
  handleOnKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void;

  /**
   * Determines whether the supplied date falls on the same calendar day as the
   * component’s `day` prop.
   *
   * @param other - Date to compare against.
   * @returns True if both dates represent the same day.
   */
  isSameDay(other?: Date | null): boolean;

  /**
   * Indicates whether the day is currently selected via keyboard navigation
   * rather than a direct click.
   *
   * @returns True when the day should present the
   * `react-datepicker__day--keyboard-selected` state.
   */
  isKeyboardSelected(): boolean;

  /**
   * Checks whether the day should be disabled based on the filtering props
   * supplied to the component.
   *
   * @param day - Optional day to test; defaults to the component’s own day.
   * @returns True if the day is disabled.
   */
  isDisabled(day?: Date): boolean;

  /**
   * Returns whether the day is explicitly excluded via `excludeDates` or
   * `excludeDateIntervals`.
   *
   * @returns True if excluded.
   */
  isExcluded(): boolean;

  /**
   * Indicates whether the day is the first day of the week according to the
   * component’s locale and `calendarStartDay` settings.
   *
   * @returns True if the day is the start of the week.
   */
  isStartOfWeek(): boolean;

  /**
   * Determines whether another date falls in the same week as the component’s
   * day (used by the week-picker variant).
   *
   * @param other - Date to compare against.
   * @returns True if both dates are in the same week.
   */
  isSameWeek(other?: Date | null): boolean;

  /**
   * Helper that returns true when `other` is either the same day _or_ in the
   * same week as the component’s day.
   *
   * @param other - Date to compare.
   * @returns True for same day or week.
   */
  isSameDayOrWeek(other?: Date | null): boolean;

  /**
   * Retrieves the highlight CSS class associated with the day via the
   * `highlightDates` prop.
   *
   * @returns The class name string or `false`/undefined when no highlight is
   * configured.
   */
  getHighLightedClass(): string | false | undefined;

  /**
   * Returns an array containing the holiday CSS class (if any) associated with
   * the day.
   *
   * @returns Array with a single class name or `[undefined]` when none.
   */
  getHolidaysClass(): (string | undefined)[];

  /**
   * Whether the day lies inside the currently selected range (`startDate` ➝
   * `endDate`).
   *
   * @returns True if the day is inside the range.
   */
  isInRange(): boolean;

  /**
   * Whether the day is inside the provisional range the user is selecting with
   * their mouse/keyboard.
   *
   * @returns True when in the selecting range.
   */
  isInSelectingRange(): boolean;

  /**
   * True when the day is the first day of the selecting range.
   */
  isSelectingRangeStart(): boolean;

  /**
   * True when the day is the last day of the selecting range.
   */
  isSelectingRangeEnd(): boolean;

  /**
   * Whether the day is the first day of the confirmed range.
   */
  isRangeStart(): boolean;

  /**
   * Whether the day is the last day of the confirmed range.
   */
  isRangeEnd(): boolean;

  /**
   * Convenience helper that returns true when the day falls on a weekend.
   */
  isWeekend(): boolean;

  /**
   * Indicates that the calendar is currently displaying a month _after_ the
   * month represented by the day (i.e. the day is one of the leading padded
   * days from the previous month).
   */
  isAfterMonth(): boolean;

  /**
   * Indicates that the calendar is currently displaying a month _before_ the
   * month represented by the day (i.e. the day is one of the trailing padded
   * days from the next month).
   */
  isBeforeMonth(): boolean;

  /**
   * Returns true when the day represents today’s date.
   */
  isCurrentDay(): boolean;

  /**
   * Whether the day is considered selected (supports single, range and
   * multiple-selection modes).
   */
  isSelected(): boolean;

  /**
   * Computes the set of CSS classes that should be applied to the day element
   * based on its state (selected, disabled, weekend, etc.).
   *
   * @param date - The date represented by the day element (usually the
   * component’s own `day` prop).
   * @returns A space-separated class list.
   */
  getClassNames(date: Date): string;

  /**
   * Produces an accessible label for the day element that conveys both the
   * calendar date and whether the day is selectable.
   *
   * @returns The aria-label string.
   */
  getAriaLabel(): string;

  /**
   * Returns the tooltip / title string for the day — typically the holiday name
   * or an exclusion message.
   */
  getTitle(): string;

  /**
   * Calculates the appropriate `tabIndex` for the day so that keyboard users
   * can navigate the calendar efficiently.
   */
  getTabIndex(): number;

  /**
   * Focuses the underlying DOM node when required.
   */
  handleFocusDay(): void;

  /**
   * Renders the inner contents of the day cell. This may be a number or a
   * custom node depending on the `renderDayContents` prop.
   */
  renderDayContents(): React.ReactNode;

  /**
   * React render method.
   */
  render(): React.ReactNode;
}

